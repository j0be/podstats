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
            value,
            entityStringId
        FROM statistics
        WHERE
            entityStringId<>"";`;

    db.all(sql, [], (err, rows) => {
        if (err) throw err;

        let sql = `SELECT
            COUNT(duration_ms) as playback_count
        FROM episodes
        WHERE
            playbackDate > -1;`;

        db.all(sql, [], (err, playback_count) => {
            if (err) throw err;

            sql = `SELECT
                SUM((duration_ms + position_to_resume)) as playback_time,
                ROUND(SUM((duration_ms + position_to_resume)/podcasts.playback_speed)) as playback_time_adjusted
            FROM episodes
                LEFT JOIN podcasts ON episodes.podcast_id = podcasts._id
            WHERE
                playbackDate > 0;`;

            db.all(sql, [], (err, calcRows) => {
                if (err) throw err;

                res.end(JSON.stringify({
                    pa: {
                        total_time: rows.find(function(row) { return row.entityStringId === 'total_time'; }).value * 1000,
                        radio_time: rows.find(function(row) { return row.entityStringId === 'radio_time'; }).value * 1000,
                        read_episodes: rows.find(function(row) { return row.entityStringId === 'read_episodes'; }).value
                    },
                    db: {
                        total_time: calcRows[0].playback_time,
                        adjusted_time: calcRows[0].playback_time_adjusted,
                        total_count: playback_count[0].playback_count
                    }
                }));
            });
        });
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
        SUM((duration_ms)) as total_time,
        ROUND(SUM((duration_ms)/podcasts.playback_speed)) as total_time_adjusted,
        COUNT(duration_ms) as total_count
    FROM episodes
    LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
    WHERE
        podcasts.subscribed_status = 1 AND
        duration_ms > 0 AND
        group_key NOT LIKE "1970%"
    GROUP BY group_key
    ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

    db.all(sql, [], (err, rows) => {
        if (err) throw err;

        sql = `SELECT
            ${getGroupKeySQL('playbackDate')}
            SUM((duration_ms + position_to_resume)) as playback_time,
            ROUND(SUM((duration_ms + position_to_resume)/podcasts.playback_speed)) as playback_time_adjusted
        FROM episodes
        LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
        WHERE
            (playbackDate > -1 OR position_to_resume > 0) AND
            duration_ms > 0
        GROUP BY group_key
        ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

        db.all(sql, [], (err, rows2) => {
            if (err) throw err;
            sql = `SELECT
            ${getGroupKeySQL('playbackDate')}
                COUNT(duration_ms) as playback_count
            FROM episodes
            LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
            WHERE
                (playbackDate > -1) AND
                duration_ms > 0
            GROUP BY group_key
            ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

            db.all(sql, [], (err, rows3) => {
                if (err) throw err;

                sql = `SELECT
                    ${getGroupKeySQL('publication_date')}
                    SUM((duration_ms - position_to_resume)) as read_time,
                    ROUND(SUM((duration_ms - position_to_resume)/podcasts.playback_speed)) as read_time_adjusted,
                    COUNT(duration_ms) as read_count
                FROM episodes
                LEFT JOIN podcasts ON podcasts._id = episodes.podcast_id
                WHERE
                    episodes.new_status = 0 AND episodes.playbackDate = -1 AND
                    duration_ms > 0 AND
                    group_key NOT LIKE "1970%"
                GROUP BY group_key
                ORDER BY group_key ${req.query.interval === 'week' ? 'DESC' : 'ASC'}`;

                // console.log(sql);

                db.all(sql, [], (err, rows4) => {
                    if (err) throw err;

                    res.end(JSON.stringify(
                        mergeArrayObjects(
                        mergeArrayObjects(
                        mergeArrayObjects(rows,
                            rows2, 'group_key'),
                            rows3, 'group_key'),
                            rows4, 'group_key')));
                });
            });

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