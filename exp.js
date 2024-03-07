const fs = require('fs');
const fs_ex = require('fs-extra');
const path = require('path');
const { google } = require('googleapis');

const TOKEN_PATH = 'token.json';
// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), jsonToSheet);
});

/**
* Create an OAuth2 client with the given credentials, and then execute the
* given callback function.
* @param {Object} credentials The authorization client credentials.
* @param {function} callback The callback to call with the authorized client.
*/
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}




/**
 * JSON 檔轉換為 ['key', 'value', 'value', 'value'] 格式
 */
const data = ['key', 'zh-tw', 'zh-cn', 'en', 'vi', 'th', 'pt'];

const files = [
  path.resolve(__dirname, './locales', `zh-tw.json`),
  path.resolve(__dirname, './locales', `zh-cn.json`),
  path.resolve(__dirname, './locales', `en.json`),
  path.resolve(__dirname, './locales', `vi.json`),
  path.resolve(__dirname, './locales', `th.json`),
  path.resolve(__dirname, './locales', `pt.json`),
];

const zhTWData = JSON.parse(fs_ex.readFileSync(files[0], 'utf8'));
const zhCNData = JSON.parse(fs_ex.readFileSync(files[1], 'utf8'));
const enData = JSON.parse(fs_ex.readFileSync(files[2], 'utf8'));
const viData = JSON.parse(fs_ex.readFileSync(files[3], 'utf8'));
const thData = JSON.parse(fs_ex.readFileSync(files[4], 'utf8'));
const ptData = JSON.parse(fs_ex.readFileSync(files[5], 'utf8'));

const translationData = {}; // 用來存放翻譯資料的物件

const translations = [
  {
    language: 'zh-tw',
    data: zhTWData,
  },
  {
    language: 'zh-cn',
    data: zhCNData,
  },
  {
    language: 'en',
    data: enData,
  },
  {
    language: 'vi',
    data: viData,
  },
  {
    language: 'th',
    data: thData,
  },
  {
    language: 'pt',
    data: ptData,
  },
];

async function jsonToSheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  /**
   * spreadsheetId: Google Sheets 的 ID
   * sheetName: 工作表名稱
   */
  const spreadsheetId = '17CvrjdaXt45fLE-QH8o-xjCJoOMqmOBWm70HXGrEKEM';
  const sheetName = 'kefu';

  for (let i = 0; i < translations.length; i++) {
    const language = translations[i].language;
    processObject(translations[i].data, '', translationData, i);
    if (language === 'vi') {
      // 將翻譯資料轉換為陣列格式並放入 data 中
      Object.entries(translationData).forEach(([key, value]) => {
        data.push([key, ...value]);
      });
    }
  }

  /**
   * 存取 Google Sheets 資料
   * 若 Google Sheets 無資料，則直接寫入資料
   * 若 Google Sheets 有資料，則比對資料是否有異動
   * 異動情況：
   * 1. 三個語言中只要有其中一個是空值，則該列多一欄為 need to translate
   * 2. 三個語言中只要有其中一個有異動，則在該欄 +4 欄放置異動後的值方便比對
   * 3. 若 JSON 檔的 key 不存在於 Google Sheets，則該列多一欄為 added
   */
  await sheets.spreadsheets.values
    .get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A2:G`,
    })
    .then(res => {
      const rows = res.data.values || [];
      if (rows.length === 0) {
        try {
          // 寫入數據到 Google Sheets
          sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A2:G`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [...data] },
          });
          console.log('JSON data imported to Google Sheets successfully.');
        } catch (error) {
          console.error('Error importing JSON data to Google Sheets:', error);
        }
      } else {
        const header = rows.map(row => row[0]);
        const length = data.length;
        for (let i = 0; i < length; i++) {
          const key = data[i][0];
          const rowIndex = header.indexOf(key);
          if (rowIndex > -1) {
            for (let j = 1; j < 4; j++) {
              if (!rows[rowIndex][j]) {
                rows[rowIndex][4] = 'need to translate';
              }
              if (rows[rowIndex][j] && rows[rowIndex][j] !== data[i][j]) {
                rows[rowIndex][j + 4] = data[i][j];
                rows[rowIndex][4] = 'updated';
              }
            }
          } else {
            const newRow = [key, data[i][1], data[i][2], data[i][3], 'added'];
            for (let j = 1; j < 4; j++) {
              if (!newRow[j]) {
                newRow[4] = 'need to translate';
              }
            }
            rows.push(newRow);
          }
        }
        sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `${sheetName}!A2:G`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [...rows] },
        });
      }
    })
    .catch(err => {
      console.log(err);
    });
}

function processObject(obj, prefix, translationData, languageOrder) {
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'object') {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      processObject(value, newPrefix, translationData, languageOrder);
    } else {
      const columnName = prefix ? `${prefix}.${key}` : key;
      const translations = translationData[columnName] ?? [];
      if (translations.length < languageOrder) {
        translations[languageOrder] = value;
      } else {
        translations.push(value);
      }
      translationData[columnName] = translations;
    }
  }
}
