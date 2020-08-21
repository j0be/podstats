const express = require('express');
const busboy = require('connect-busboy');
const app = express();

app.use(busboy());

app.get('/*', function(req, res, next) {
    console.debug(`GET route: ${decodeURIComponent(req.url)}`);
    next();
});
app.post('/*', function(req, res, next) {
    console.debug(`POST route: ${decodeURIComponent(req.url)}`);
    next();
});

// This handles api requests
require('./api/api')(app);

// This is what the user uses when navigating to the root in the browser
require('./public/public')(app);

let port = 3000;
if (process.argv.length > 2) {
    process.argv.forEach(function(param) {
        var valIndex = param.indexOf('=')+1;
          if(param.includes('--protocol')){
              protocol = param.substr(valIndex);
          }
          else if(param.includes('--port')){
              port = param.substr(valIndex);
          }
    });
}

app.listen(process.env.PORT || port, () => {
    console.log(`\x1b[32mPodStats started: \x1b[0mhttp://localhost:${process.env.PORT || port}\n`);
});