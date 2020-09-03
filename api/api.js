const bodyParser = require('body-parser');

module.exports = function(app) {
    app.use(bodyParser.json({
        limit: '100mb'
    }));
    app.use(bodyParser.urlencoded({
        extended: true,
        limit: '100mb'
    }));
    app.use(bodyParser.text({
        limit: '100mb'
    }));

    require('./uploads')(app);
    require('./stats')(app);
};