const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const baseDBPath = path.resolve(__dirname) + '/../dbs/';
let remoteAddress;

function getDB() {
    return new sqlite3.Database(`${baseDBPath}${remoteAddress}.db`);
}

function mergeArrayObjects(arr1, arr2, keyName) {
    return arr1.map(function (item, i) {
        return Object.assign({}, item, arr2.find(function(item2) {
            return item[keyName] === item2[keyName];
        }));
    });
}

function getTotal(req, res, next) {
    let db = getDB();
    let sql = `SELECT
            duration_ms,
            podcast_id
        FROM episodes
        WHERE playbackDate > 0;`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }

        res.end(JSON.stringify({
            pa: {
                total_time: 20000
            },
            db: {
                total_time: 20000,
                adjusted_time: 20000
            }
        }));
    });
    db.close();
}

function getPodcastTotals(req, res, next) {
    let db = getDB();
    let sql = `SELECT
        podcasts.name,
        COUNT(podcast_id) as played_count,
        SUM(duration_ms) as total_time,
        AVG(duration_ms) as avg_time
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
        week: '%Y-%m-%d', // week subtraction gets appended
        day: '%Y-%m-%d'
    };

    let interval = intervalMapper[req.query.interval] || intervalMapper.year;
    let db = getDB();

    function getGroupKeySQL(key) {
        if (req.query.interval === 'week') {
            return `
                STRFTIME('${interval}', DATETIME('now')) || '-' || substr('0000000'|| ROUND( ( ( JULIANDAY('now') - JULIANDAY( DATETIME( ROUND( ${key} / 1000 ), 'unixepoch' ) ) ) / 7 ) - 0.5, 0 ), -7, 7 ) as group_key,`;
        }

        return `
            STRFTIME('${interval}', DATETIME(ROUND(${key} / 1000), 'unixepoch')) as group_key,`;
    }


    let sql = `SELECT
        ${getGroupKeySQL('publication_date')}
        SUM(duration_ms) as total_time,
        SUM(duration_ms/podcasts.playback_speed) as total_time_adjusted,
        COUNT(duration_ms) as total_count
    FROM episodes
    LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
    WHERE
        group_key NOT LIKE "1970%" AND
        podcasts.subscribed_status = 1
    GROUP BY group_key
    ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

    db.all(sql, [], (err, rows) => {
        if (err) throw err;

        sql = `SELECT
            ${getGroupKeySQL('playbackDate')}
            SUM(duration_ms) as playback_time,
            SUM(duration_ms/podcasts.playback_speed) as playback_time_adjusted,
            COUNT(duration_ms) as playback_count
        FROM episodes
        LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
        WHERE playbackDate > 0
        GROUP BY group_key
        ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

        db.all(sql, [], (err, rows2) => {
            if (err) throw err;

            res.end(JSON.stringify(mergeArrayObjects(rows, rows2, 'group_key')));
        });
    });
    db.close();
}

function getPodBubble(req, res, next) {

}

module.exports = function(app) {
    app.all('/api/*', function (req, res, next) {
        remoteAddress = req.connection.remoteAddress.replace(/[^\d\w]/g, '');
        next();
    });

    app.post('/api/stats/total', getTotal);
    app.post('/api/stats/podcast', getPodcastTotals);
    app.post('/api/stats/time', getTime);
    app.post('/api/stats/podbubbles', getPodBubble);
};