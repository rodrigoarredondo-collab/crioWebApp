import { google } from 'googleapis'
import * as xlsx from 'xlsx'

/**
 * Utility function to retrieve data from a private Google Spreadsheet.
 * 
 * Requires a Google Cloud Service Account with access to the Google Sheets API.
 * The Service Account's email must be added as a viewer/editor on the private Google Sheet.
 * 
 * You need to define the following in your .env or .env.local:
 * GOOGLE_CLIENT_EMAIL=your-service-account-email@project.iam.gserviceaccount.com
 * GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
 */
export async function getPrivateGoogleSheetData(sheetId: string, range: string): Promise<string[][] | null> {
    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
        // Replace literal '\n' with actual linebreaks if needed
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

        if (!clientEmail || !privateKey) {
            throw new Error("Google Service Account credentials are not configured in environment variables.")
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        })

        const sheets = google.sheets({ version: 'v4', auth })

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        })

        // response.data.values is a 2D array of the sheet rows
        const rows = response.data.values as string[][]

        if (!rows || rows.length === 0) {
            console.log('No data found in the spreadsheet range.')
            return []
        }

        return rows
    } catch (error) {
        console.error("Error fetching private Google Sheet data:", error)
        return null
    }
}

/**
 * Utility function to retrieve data from a private EXCEL (.xlsx) file in Google Drive.
 * 
 * Requires the same Service Account credentials as Google Sheets API,
 * but uses the Google Drive API to download the file and `xlsx` to parse it.
 */
export async function getPrivateDriveExcelData(fileId: string): Promise<string[][] | null> {
    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

        if (!clientEmail || !privateKey) {
            throw new Error("Google Service Account credentials are not configured in environment variables.")
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive'],
        })

        const drive = google.drive({ version: 'v3', auth })

        // 1. Download the file from Google Drive as an arraybuffer
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        )

        const buffer = response.data as ArrayBuffer

        // 2. Parse the buffer using xlsx
        const workbook = xlsx.read(buffer, { type: 'buffer' })

        // 3. Get the first sheet name
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // 4. Convert sheet to 2D array (array of arrays)
        // Default header: 1 means we always get a 2D array of values, even if entirely numeric
        // defval: "" ensures empty cells aren't skipped causing columns to shift
        const rows = xlsx.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" })

        if (!rows || rows.length === 0) {
            console.log('No data found in the Excel file.')
            return []
        }

        return rows
    } catch (error) {
        console.error("Error fetching private Excel data from Drive:", error)
        return null
    }
}

/**
 * Append rows to a Google Sheet using the native Sheets API append method.
 * This is efficient — it only adds new rows without downloading or re-uploading the file.
 */
export async function appendToGoogleSheet(sheetId: string, newRows: string[][], sheetName: string = 'Sheet1'): Promise<number> {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!clientEmail || !privateKey) {
        throw new Error("Google Service Account credentials are not configured in environment variables.")
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // 1. Fetch current data to find the TRUE last row (ignoring empty formatted cells)
    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: sheetName,
    })

    const currentRows = existing.data.values || [];
    let lastContentRow = 0;
    for (let i = currentRows.length - 1; i >= 0; i--) {
        // Find the first row from bottom that has at least one non-empty string cell
        if (currentRows[i].some(cell => cell && String(cell).trim() !== '')) {
            lastContentRow = i + 1; // 1-indexed for the sheet
            break;
        }
    }

    // Default to pasting at row 2 if sheet is totally empty (assuming a header at row 1)
    // but if lastContentRow is found, paste at lastContentRow + 1
    const targetRow = Math.max(lastContentRow + 1, currentRows.length === 0 ? 1 : 2);

    // 2. Update to that explicit target range instead of using 'append'
    const response = await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: newRows,
        },
    })

    return response.data.updatedRows || 0
}

/**
 * Export a Google Sheet (or Google Drive format) to native .xlsx format.
 */
export async function getPrivateGoogleSheetXlsx(fileId: string): Promise<ArrayBuffer | null> {
    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

        if (!clientEmail || !privateKey) {
            throw new Error("Google Service Account credentials are not configured.")
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        })

        const drive = google.drive({ version: 'v3', auth })

        const response = await drive.files.export(
            { fileId: fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { responseType: 'arraybuffer' }
        )

        return response.data as ArrayBuffer
    } catch (error) {
        console.error("Error exporting private Google Sheet to xlsx:", error)
        return null
    }
}
