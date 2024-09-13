import React, { useState, useEffect, useCallback, useRef } from 'react';
import VirtualEmojiPickerGridComponent from "./components/virtual-emoji-picker-grid";
import { Header } from "./components/header";

interface UpdateMessage {
  row: number;
  col: number;
  value: number;
}

const App: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [intArray, setIntArray] = useState<Array<number> | null>(null);
  const isConnecting = useRef(false);

  const connectWebSocket = useCallback(() => {
    if (ws !== null || isConnecting.current) {
      return;
    }
    isConnecting.current = true;
    console.log('Attempting to connect to WebSocket server...');
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      console.log('Connected to WebSocket server');
      isConnecting.current = false;
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          // Handle full grid update
          const buffer = event.data as ArrayBuffer;
          const dataView = new DataView(buffer);
          // Create an array to hold the 16-bit values
          const uint16Array = new Array(buffer.byteLength / 2);
          for (let i = 0; i < buffer.byteLength; i += 2) {
            uint16Array[i / 2] = dataView.getUint16(i, false); // false for big-endian
          }
          setIntArray(uint16Array);
        } else {
          // Handle individual cell update
          const { row, col, value } = JSON.parse(event.data);
          setIntArray(prevArray => {
            if (prevArray === null) {
              return null;
            }
            const newArray = [...prevArray];
            const index = row * 1000 + col;  // Assuming 1000x1000 grid
            newArray[index] = value;
            return newArray;
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    socket.onclose = (event: CloseEvent) => {
      console.log('Disconnected from WebSocket server:', event.reason);
      isConnecting.current = false;
      // Attempt to reconnect after a delay
      setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      isConnecting.current = false;
    };

    setWs(socket);
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket, ws]);

  const sendUpdateMessage = useCallback((row: number, col: number, value: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const updateMessage: UpdateMessage = { row, col, value: value & 0xFFFF };
      ws.send(JSON.stringify(updateMessage));
    } else {
      console.error('WebSocket is not connected. Unable to send update message.');
    }
  }, [ws]);

  return (
    <>
      <Header />
      <VirtualEmojiPickerGridComponent intArray={intArray} sendUpdate={sendUpdateMessage} />
      </>
  );
};

export default App;
