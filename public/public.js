const path = require('path');

module.exports = function (app) {
    console.debug('Registering public routes');
    app.get('/public/*', function(req, res, next) {
        let reqPath = req.url.split('/').slice(2).join('/');
        res.sendFile(path.join(__dirname + '/' + reqPath));
        res.status(200);
    });

    app.get('/*', function(req, res, next) {
        console.debug(`Request route: ${decodeURIComponent(req.url)}`);
    });
};