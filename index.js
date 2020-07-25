const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const express = require('express');
const axios = require('axios');
const credentials = require('./credentials.json').installed;

const app = express();
app.use(express.json()) 

const {client_secret, client_id, redirect_uris} = credentials;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);


app.get('/google/auth', (req, res) => {
  res.send(`Authorization code: ${req.query.code}`);
});

app.post('/upload', (req, res) => {
  searchFile(oAuth2Client, req.body);
  res.status(200).end()
});

var server = app.listen(5000, () => {
  console.log('Server listening on port 5000');
});

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.metadata'];

const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(searchFile);
});

function authorize(callback) {
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
  });
}

function getAccessToken(oAuth2Client, callback) {
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
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
      
    });
  });
}

function searchFile(auth, body) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    q: `name='${body.name}'`,
    pageSize: 40,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    var files = res.data.files.map((file) => {return file.name});
    var ids = res.data.files.map((file) => {return file.id});
    console.log(`Arquivos encontrados: ${files}`);
    if(files.indexOf(body.name) > -1) {
      console.log('Arquivo de medição encontrado. Atualizando arquivo!');
      var id = ids[files.indexOf(body.name)];
      updateData(auth, id, body.name, body.data);
    } else {
      console.log('Arquivo de medição não encontrado. Criando um novo arquivo!');
      createFile(auth, body.name, body.data)
    }
  });
}

function updateData(auth, id, filename, filedata) {
  const sheets = google.sheets({version: 'v4', auth});
  console.log(`Filename: ${filename}`);
  console.log(`id: ${id}`);
  console.log(`data: ${filedata}`);
  var data = filedata.replace(/\.+/g, ',');
  data = data.split(';');
  console.log(`data: ${data}`);
  let values = [
    data
  ];
  const resource = {
    values,
  };
  sheets.spreadsheets.values.append ({
    spreadsheetId: id,
    range: 'A1:H1',
    resource,
    valueInputOption: 'USER_ENTERED'
  }, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log('%d cells updated.', result.updatedCells);
    }
  });
}

function createFile(auth, filename, filedata) {
  const drive = google.drive({version: 'v3', auth});
  var fileMetadata = {
    'name': filename,
    'mimeType': 'application/vnd.google-apps.spreadsheet'
  };
  var media = {

  };
  drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      // Handle error
      console.error(err);
    } else {
      console.log(`Arquivo criado com sucesso! Id: ${file.data.id}`);
      updateData(auth, file.data.id, filename, filedata)
    }
  });
}