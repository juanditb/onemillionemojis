// Parses this list of emojis: https://www.prosettings.com/emoji-list/
const fs = require('fs');
const cheerio = require('cheerio');

// Function to read HTML file
function readHTMLFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Function to process tags
function processTags(ename) {
  const ignoredWords = ['the', 'with', 'on', 'over', 'and', 'or', 'in'];
  const tagsSet = new Set(
    ename.split(' ')
      .map(word => word.replace(/[^a-zA-Z]/g, '').toLowerCase())
      .filter(word => !ignoredWords.includes(word) && word.length > 0)
  );
  return Array.from(tagsSet);
}

// Function to parse HTML and extract data
function parseHTMLTable(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('table tr').each((index, element) => {
    const $row = $(element);
    const $echars = $row.find('td.echars');
    const $ename = $row.find('td.ename');
    const $eno = $row.find('td.eno');

    if ($echars.length && $ename.length && $eno.length) {
      results.push({
        id: $eno.text().trim(),
        emoji: $echars.text().trim(),
        tags: processTags($ename.text().trim())
      });
    }
  });

  return results;
}

// Function to write JSON file
function writeJSONFile(data, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

// Main function
function main() {
  const inputFile = 'source.html';
  const outputFile = 'emojis.json';

  const htmlContent = readHTMLFile(inputFile);
  const parsedData = parseHTMLTable(htmlContent);
  writeJSONFile(parsedData, outputFile);

  console.log(`Parsed data has been written to ${outputFile}`);
}

main();