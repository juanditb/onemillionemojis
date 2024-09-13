package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

const (
	redisKey           = "grid"
	redisPubSubChannel = "grid_updates"
	gridSize           = 1000
	totalBits          = gridSize * gridSize * 16
	totalBytes         = totalBits / 8
	websocketPort      = "8888"
	rateLimit          = 5 // messages per second
	burstLimit         = 10 // maximum burst size
	emojiListSize      = 1644
)

var (
	rdb      *redis.Client
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients    = make(map[*websocket.Conn]*rate.Limiter)
	clientsMux sync.Mutex
)

type UpdateMessage struct {
	Row   int `json:"row"`
	Col   int `json:"col"`
	Value int `json:"value"`
}

func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})
}

func initGrid(ctx context.Context) error {
	exists, err := rdb.Exists(ctx, redisKey).Result()
	if err != nil {
		return err
	}

	if exists == 0 {
		_, err := rdb.SetBit(ctx, redisKey, int64(totalBits-1), 0).Result()
		if err != nil {
			return err
		}
	}

	return nil
}

func getGrid(ctx context.Context) ([]byte, error) {
	return rdb.GetRange(ctx, redisKey, 0, int64(totalBytes-1)).Bytes()
}

func updateGrid(ctx context.Context, row, col, value int) error {
	if row < 0 || row >= gridSize || col < 0 || col >= gridSize {
		return fmt.Errorf("invalid row or column")
	}
	if value < 0 || value > emojiListSize {
		return fmt.Errorf("value out of range for emoji list")
	}
	currValue, _ := getValueAt(ctx, row, col)
	if currValue != 0 {
		return fmt.Errorf("value already set")
	}
	index := (row*gridSize + col) * 16
	_, err := rdb.BitField(ctx, redisKey, "SET", "u16", index, value).Result()
	return err
}

func getValueAt(ctx context.Context, row, col int) (int, error) {
	if row < 0 || row >= gridSize || col < 0 || col >= gridSize {
		return 0, fmt.Errorf("invalid row or column")
	}

	index := (row*gridSize + col) * 16
	result, err := rdb.BitField(ctx, redisKey, "GET", "u16", index).Result()
	if err != nil {
		return 0, err
	}
	if len(result) == 0 {
		return 0, fmt.Errorf("no value returned")
	}
	return int(result[0]), nil
}

func broadcastUpdate(update UpdateMessage) {
	clientsMux.Lock()
	defer clientsMux.Unlock()

	updateJSON, err := json.Marshal(update)
	if err != nil {
		log.Println("Error marshaling update:", err)
		return
	}

	for client := range clients {
		err := client.WriteMessage(websocket.TextMessage, updateJSON)
		if err != nil {
			log.Printf("Error sending update to client: %v", err)
			client.Close()
			delete(clients, client)
		}
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	limiter := rate.NewLimiter(rate.Limit(rateLimit), burstLimit)

	clientsMux.Lock()
	clients[conn] = limiter
	clientsMux.Unlock()

	defer func() {
		clientsMux.Lock()
		delete(clients, conn)
		clientsMux.Unlock()
	}()

	ctx := context.Background()

	// Send initial grid state
	gridData, err := getGrid(ctx)
	if err != nil {
		log.Println("Error getting grid data:", err)
		return
	}

	err = conn.WriteMessage(websocket.BinaryMessage, gridData)
	if err != nil {
		log.Println("Error sending initial grid state:", err)
		return
	}

	// Listen for update messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		if err := limiter.Wait(ctx); err != nil {
			log.Printf("Rate limit exceeded: %v", err)
			conn.WriteMessage(websocket.TextMessage, []byte("Rate limit exceeded. Please slow down."))
			continue
		}

		var update UpdateMessage
		err = json.Unmarshal(message, &update)
		if err != nil {
			log.Println("Error unmarshaling update message:", err)
			continue
		}

		err = updateGrid(ctx, update.Row, update.Col, update.Value)
		if err != nil {
			log.Println("Error updating grid:", err)
			conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error: %v", err)))
			continue
		}

		// Publish the update to Redis channel
		updateJSON, _ := json.Marshal(update)
		err = rdb.Publish(ctx, redisPubSubChannel, updateJSON).Err()
		if err != nil {
			log.Printf("Error publishing update: %v", err)
		}
	}
}

func subscribeToUpdates(ctx context.Context) {
	pubsub := rdb.Subscribe(ctx, redisPubSubChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {
		var update UpdateMessage
		err := json.Unmarshal([]byte(msg.Payload), &update)
		if err != nil {
			log.Printf("Error unmarshaling update from Redis: %v", err)
			continue
		}
		broadcastUpdate(update)
	}
}

func main() {
	initRedis()
	ctx := context.Background()

	err := initGrid(ctx)
	if err != nil {
		log.Fatal("Error initializing grid:", err)
	}

	// Start the Redis subscription in a separate goroutine
	go subscribeToUpdates(ctx)

	// Serve static files from the React app build directory
	fs := http.FileServer(http.Dir("emojiclient/dist"))
	http.Handle("/", http.StripPrefix("/", fs))

	// WebSocket route
	http.HandleFunc("/ws", handleWebSocket)

	fmt.Printf("Server listening on port %s\n", websocketPort)
	log.Fatal(http.ListenAndServe(":"+websocketPort, nil))
}
