const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const baseDBPath = path.resolve(__dirname) + '/../dbs/';
let remoteAddress;

function getTotal(req, res, next) {
    let db = new sqlite3.Database(`${baseDBPath}${remoteAddress}.db`);
    let sql = `SELECT SUM(duration_ms) as total_time
        FROM episodes
        WHERE playbackDate > 0;`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.end(JSON.stringify({
            total_time: rows[0].total_time
        }));
    });
    db.close();
}

function getPodcastTotals(req, res, next) {
    let db = new sqlite3.Database(`${baseDBPath}${remoteAddress}.db`);
    let sql = `SELECT
        podcasts.name,
        COUNT(podcast_id) as played_count,
        SUM(duration_ms) as total_time
    FROM episodes
        LEFT JOIN podcasts ON episodes.podcast_id = podcasts._id
    WHERE episodes.playbackDate > 0
    GROUP BY podcast_id
    ORDER BY total_time DESC;`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.end(JSON.stringify(rows));
    });
    db.close();
}

function getTime(req, res, next) {
    let intervalMapper = {
        year: '%Y',
        month: '%Y-%m',
        week: '%Y-%m-w%W',
        day: '%Y-%m-%d'
    };

    let interval = intervalMapper[req.query.interval] || intervalMapper.year;
    let db = new sqlite3.Database(`${baseDBPath}${remoteAddress}.db`);
    let sql = `SELECT
        ${req.query.interval === 'week' ? 'ROUND(((JULIANDAY(\'now\') - JULIANDAY(DATETIME(ROUND(playbackDate / 1000), \'unixepoch\'))) / 7) - 0.5) as group_key,': ''}
        STRFTIME('${interval}', DATETIME(ROUND(playbackDate / 1000), 'unixepoch')) as ${req.query.interval === 'week' ? 'date_key' : 'group_key'},
        SUM(duration_ms) as total_time
    FROM episodes
    WHERE playbackDate > 0
    GROUP BY group_key
    ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.end(JSON.stringify(rows));
    });
    db.close();
}

module.exports = function(app) {
    app.all('/api/*', function (req, res, next) {
        remoteAddress = req.connection.remoteAddress.replace(/[^\d\w]/g, '');
        next();
    });

    app.post('/api/stats/total', getTotal);
    app.post('/api/stats/podcast', getPodcastTotals);
    app.post('/api/stats/time', getTime);
};