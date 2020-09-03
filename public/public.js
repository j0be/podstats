const fs = require('fs');
const path = require('path');
const baseDBPath = path.resolve(__dirname) + '/../dbs/';
let remoteAddress;

module.exports = function (app) {
    console.debug('Registering public routes');
    app.all('/*', function (req, res, next) {
        remoteAddress = req.connection.remoteAddress.replace(/[^\d\w]/g, '');
        next();
    });

    app.get('/public/*', function(req, res, next) {
        let reqPath = req.url.split('/').slice(2).join('/');
        res.sendFile(path.join(__dirname + '/' + reqPath));
        res.status(200);
    });

    app.get('/favicon.ico', function(req, res, next) {
        res.sendFile(path.join(__dirname + '/assets/favicon.png'));
        res.status(200);
    });

    app.get('/stats', function(req, res, next) {
        res.sendFile(path.join(__dirname + '/stats.html'));
        res.status(200);
    });

    app.get('/', function(req, res, next) {
        if (fs.existsSync(`${baseDBPath}${remoteAddress}.db`)) {
            res.sendFile(path.join(__dirname + '/stats.html'));
        } else {
            res.sendFile(path.join(__dirname + '/index.html'));
        }
        res.status(200);
    });
};
