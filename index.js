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
  
  listFiles(oAuth2Client, req.body, uploadFiles);
  res.status(200).end()
});

var server = app.listen(5000, () => {
  console.log('Server listening on port 5000');
});

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.metadata','https://www.googleapis.com/auth/drive.readonly'];

const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize();
});

function authorize() {
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

function listFiles(auth, body, callback) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    q: `name='${body.name}'`,
    pageSize: 40,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files.map((file) => {return file.name});
    console.log(files);

    callback(auth, body.name, body.data);
    // if (files.length) {
    //   console.log('Files:');
    //   files.map((file) => {
    //     console.log(`${file.name} (${file.id})`);
    //   });
    // } else {
    //   console.log('No files found.');
    // }
  });
}

function uploadFiles(auth, filename, filedata) {
  const drive = google.drive({version: 'v3', auth});
  var fileMetadata = {
    'name': filename
  };
  var media = {
    mimeType: 'text/csv',
    body: filedata
  };
  drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      console.error(err);
    } else {
      console.log('File Id: ', file.data.id);
    }
  });
}

//function uploadFilesAxios(auth, filename, filedata)

  // axios({
  //   method: 'post',
  //   url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media',
  //   headers: {
  //     'X-Requested-With': 'XMLHttpRequest'
  //   },
  //   data: {
  //     firstName: 'Fred',
  //     lastName: 'Flintstone'
  //   }
  // });