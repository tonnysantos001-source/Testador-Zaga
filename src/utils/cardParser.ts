export interface ParsedCard {
    number: string;
    month: string;
    year: string;
    cvv: string;
    holder?: string;
    original: string;
}

export const parseCardLine = (line: string): ParsedCard | null => {
    // Remove espaços extras
    const cleanLine = line.trim();
    if (!cleanLine) return null;

    // Regex para encontrar o número do cartão (13 a 19 dígitos)
    const panMatch = cleanLine.match(/(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})/);
    const numberMatch = panMatch ? panMatch[0] : cleanLine.match(/\d{13,19}/)?.[0];

    if (!numberMatch) return null;

    // Remove o número do cartão da linha
    let remainingText = cleanLine.replace(numberMatch, '');

    // Regex para Data
    let month = '';
    let year = '';

    const dateMatch = remainingText.match(/(\d{1,2})[\/\|\-\.](\d{2,4})/);

    if (dateMatch) {
        month = dateMatch[1].padStart(2, '0');
        year = dateMatch[2];
        remainingText = remainingText.replace(dateMatch[0], '');
    } else {
        const simpleDateMatch = remainingText.match(/(0[1-9]|1[0-2])(2[0-9]|[3-9][0-9])/);
        if (simpleDateMatch) {
            month = simpleDateMatch[1];
            year = simpleDateMatch[2];
            remainingText = remainingText.replace(simpleDateMatch[0], '');
        }
    }

    if (year && year.length === 2) year = '20' + year;

    // Regex para CVV
    const numbersOnly = remainingText.replace(/\D/g, ' ');
    const possibleCVVs = numbersOnly.split(' ').filter(n => n.length === 3 || n.length === 4);

    let cvv = '';
    for (const p of possibleCVVs) {
        if (p !== month && p !== year && p !== year.substring(2)) {
            cvv = p;
            remainingText = remainingText.replace(p, '');
            break;
        }
    }

    // Se falhar detecção inteligente, tenta split por pipe ou vírgula
    if (!month || !year || !cvv) {
        const separators = ['|', ',', ';'];
        for (const sep of separators) {
            if (cleanLine.includes(sep)) {
                const parts = cleanLine.split(sep).map(p => p.trim());
                if (parts.length >= 4) {
                    if (!month) month = parts[1];
                    if (!year) year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    if (!cvv) cvv = parts[3];
                    // Tenta achar nome na parte 4 ou 0 se não for número
                    if (parts.length > 4 && isNaN(Number(parts[4]))) remainingText = parts[4];
                    else if (isNaN(Number(parts[0])) && parts[0] !== numberMatch) remainingText = parts[0];
                }
                break;
            }
        }
    }

    // Extração de Nome (o que sobrou de texto, removendo caracteres especiais comuns)
    let holder = remainingText
        .replace(/[|;,\/\.\-]/g, ' ') // Remove separadores
        .replace(/\d+/g, '') // Remove números (CPFs, etc)
        .trim()
        .replace(/\s+/g, ' '); // Normaliza espaços

    // Se o nome for muito curto, ignora
    if (holder.length < 3) holder = undefined;

    return {
        number: numberMatch,
        month: month || '01',
        year: year || '2028',
        cvv: cvv || '000',
        holder: holder?.toUpperCase(),
        original: line
    };
};

// Algoritmo de Luhn para validar cartão
function isValidLuhn(value: string) {
    if (/[^0-9-\s]+/.test(value)) return false;

    let nCheck = 0, nDigit = 0, bEven = false;
    value = value.replace(/\D/g, "");

    for (let n = value.length - 1; n >= 0; n--) {
        let cDigit = value.charAt(n),
            nDigit = parseInt(cDigit, 10);

        if (bEven) {
            if ((nDigit *= 2) > 9) nDigit -= 9;
        }

        nCheck += nDigit;
        bEven = !bEven;
    }

    return (nCheck % 10) == 0;
}
