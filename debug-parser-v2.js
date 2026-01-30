function testParsing() {
    console.log("Testing parsing logic...");
    const input = "5309940633589012 , 03, 2028, 599, ROSANGELA FATIMA PALADINO, 07147051925";
    console.log(`Input: "${input}"`);

    const cleanLine = input.trim();
    if (!cleanLine) {
        console.log("Empty line");
        return;
    }

    // 1. Regex match
    const panMatch = cleanLine.match(/(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})/);
    const numberMatch = panMatch ? panMatch[0] : cleanLine.match(/\d{13,19}/)?.[0];

    console.log("Number Match:", numberMatch);

    if (!numberMatch) {
        console.log("No number match -> return null");
        return;
    }

    let remainingText = cleanLine.replace(numberMatch, '');
    let month = '';
    let year = '';
    let cvv = '';

    // Date regex
    const dateMatch = remainingText.match(/(\d{1,2})[/|\-.](\d{2,4})/);
    if (dateMatch) {
        console.log("Date Match 1:", dateMatch[0]);
    } else {
        const simpleDateMatch = remainingText.match(/(0[1-9]|1[0-2])(2[0-9]|[3-9][0-9])/);
        if (simpleDateMatch) {
            console.log("Date Match 2:", simpleDateMatch[0]);
            month = simpleDateMatch[1];
            year = simpleDateMatch[2];
        }
    }

    // Fallback
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

                    console.log(`Detected via separator: M=${month}, Y=${year}, CVV=${cvv}`);
                }
                break;
            }
        }
    }

    // Check validation of month/year
    // In cardParser.ts there is no validation check that returns null, EXCEPT isValidLuhn log warning.

    console.log("Result:", { number: numberMatch, month, year, cvv });
}

testParsing();
