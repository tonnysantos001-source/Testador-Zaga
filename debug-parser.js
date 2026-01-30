const { parseCardLine } = require('./src/utils/cardParser.ts');

// Mock implementation of parseCardLine since we can't import TS directly easily without compilation in this context, 
// OR we can just copy the logic effectively for testing.
// Better: I'll implement a test that mimicks the logic I saw in view_file to confirm behavior.

function testParsing() {
    console.log("Testing parsing logic...");
    const input = "5309940633589012 , 03, 2028, 599, ROSANGELA FATIMA PALADINO, 07147051925";

    // Logic from cardParser.ts
    const cleanLine = input.trim();
    // 1. Number match
    const panMatch = cleanLine.match(/(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})/);
    const numberMatch = panMatch ? panMatch[0] : cleanLine.match(/\d{13,19}/)?.[0];

    console.log("Number Match:", numberMatch);

    let remainingText = cleanLine.replace(numberMatch, '');
    let month = '';
    let year = '';
    let cvv = '';

    // Date Match logic
    const dateMatch = remainingText.match(/(\d{1,2})[/|\-.](\d{2,4})/);
    if (!dateMatch) {
        console.log("Date not matched with slash/dash.");
    }

    // Fallback logic
    if (!month || !year || !cvv) {
        const separators = ['|', ',', ';'];
        for (const sep of separators) {
            if (cleanLine.includes(sep)) {
                console.log(`Using separator: '${sep}'`);
                const parts = cleanLine.split(sep).map(p => p.trim());
                if (parts.length >= 4) {
                    if (!month) month = parts[1].padStart(2, '0');
                    if (!year) year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    if (!cvv) cvv = parts[3];

                    console.log(`Parts detected: Month=${month}, Year=${year}, CVV=${cvv}`);
                }
                break;
            }
        }
    }

    if (month && year && cvv && numberMatch) {
        console.log("✅ PARSING SUCCESSFUL");
        return true;
    } else {
        console.log("❌ PARSING FAILED");
        return false;
    }
}

testParsing();
