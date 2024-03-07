
const fs = require('fs');
const fs_ex = require('fs-extra');
const path = require('path');
const unflatten = require('unflatten');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), listMajors);
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
* Get and store new token after prompting for user authorization, and then
* execute the given callback with the authorized OAuth2 client.
* @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
* @param {getEventsCallback} callback The callback for the authorized client.
*/

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

async function listMajors(auth) {

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1DsKSOli1vS97w9ynvZ2miy4Q88Vrd7FpSftDAeNUVKo';
  const sheetName = 'kefu';

  const files = ['zh-tw', 'zh-cn', 'en', 'vi', 'th', 'pt'];
  const filePaths = [
    path.resolve(__dirname, './locales', `zh-tw.json`),
    path.resolve(__dirname, './locales', `zh-cn.json`),
    path.resolve(__dirname, './locales', `en.json`),
    path.resolve(__dirname, './locales', `vi.json`),
    path.resolve(__dirname, './locales', `th.json`),
    path.resolve(__dirname, './locales', `pt.json`),
  ];
  const existingFiles = {
    'zh-tw': fs_ex.readJSONSync(filePaths[0]),
    'zh-cn': fs_ex.readJSONSync(filePaths[1]),
    'en': fs_ex.readJSONSync(filePaths[2]),
    'vi': fs_ex.readJSONSync(filePaths[3]),
    'th': fs_ex.readJSONSync(filePaths[4]),
    'pt': fs_ex.readJSONSync(filePaths[5]),
  };

  sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A2:G`,
  }, (err, res) => {

    const result = res.data.values;

    for (let i = 1; i < result.length; i++) {
      const key = result[i][0];

      // 語言包
      for (let t = 0; t < files.length; t++) {
        const value = result[i][t + 1] ? result[i][t + 1] : '';
        
        if (value !== undefined && value !== '') {
          const keys = key.split('.');

          let current = existingFiles[files[t]];

          for (let m = 0; m < keys.length; m++) {
            const k = keys[m];
            if (!current[k]) {
              current[k] = {};
            }
            if (m === keys.length - 1) {
              current[k] = value;
            } else {
              current = current[k];
            }
          }
        }
      }
    }

    for (const fileName of files) {
      fs_ex.writeJSONSync(
        path.resolve(__dirname, './locales', `${fileName}.json`),
        unflatten(existingFiles[fileName], { object: true }),
        { spaces: 2 },
      );
    }


  });


}
