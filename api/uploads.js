const fs = require('fs');
const path = require('path');
const stream = require('stream');
const xmlParser = require('xml2json');
const unzipper = require('unzipper');
const sqlite3 = require('sqlite3').verbose();

const baseUploadPath = path.resolve(__dirname) + '/../uploads/';
const baseDBPath = path.resolve(__dirname) + '/../dbs/';

let remoteAddress;

function getDB() {
    return new sqlite3.Database(`${baseDBPath}${remoteAddress}.db`);
}

function getSettings() {
    return JSON.parse(xmlParser.toJson(fs.readFileSync(`${baseDBPath}${remoteAddress}.xml`, 'utf8'))).map;
}

function getSetting(settings, type, name) {
    let typeArr = settings[type] || settings.map[type];
    return (typeArr.find(function(setting) {
        return setting.name === name;
    }) || {}).value;
}

function alterDatabase() {
    console.log('Altering DB to add some settings');
    let settings = getSettings();
    let defaultSpeed = getSetting(settings, 'float', 'pref_speedAdjustment') || 1;

    let db = getDB();

    let sql = 'DELETE FROM statistics';

    db.all(sql, [], (err, rows) => {
        if (err) throw err;

        let stats = [
            { name: 'total_time', value: getSetting(settings, 'long', 'stats_totalDuration') },
            { name: 'read_episodes', value: getSetting(settings, 'int', 'stats_readEpisodes') },
            { name: 'radio_time', value: getSetting(settings, 'long', 'stats_liveRadioTotalDuration') },
        ];
        stats.forEach(function (stat) {
            sql = `INSERT INTO statistics (
                    entityType,
                    entityId,
                    type,
                    timestamp,
                    entityStringId,
                    value
                ) VALUES (
                    0,
                    0,
                    0,
                    0,
                    "${stat.name}",
                    "${stat.value}"
                );`;
            db.all(sql, [], (err, rows) => {
                if (err) throw err;
            });
        });

        sql = `ALTER TABLE podcasts
            ADD playback_speed DECIMAL (10, 2) NOT NULL DEFAULT ${defaultSpeed}`;

        db.all(sql, [], (err, rows) => {
            if (err) throw err;

            sql = '';

            settings.float.filter(function(setting) {
                return setting.name.match('pref_speedAdjustment_');
            }).forEach(function(setting) {
                if (setting.value != defaultSpeed) {
                    let podcast_id = setting.name.replace('pref_speedAdjustment_', '');
                    sql += `\nUPDATE podcasts
                        set playback_speed = ${setting.value}
                        WHERE _id = ${podcast_id};`;
                }
            });

            db.all(sql, [], (err, rows) => {
                if (err) throw err;
            });
        });
    });

    db.close();
}

function uploadFile(req, res, next) {
    let fstream;
    let formFields = {};

    req.pipe(req.busboy);
    req.busboy.on('field', function(fieldName, val) {
        formFields[fieldName] = val;
    });

    req.busboy.on('file', function (fieldName, file, filename) {
        fstream = fs.createWriteStream(`${baseUploadPath}${remoteAddress}.zip`);

        file.pipe(fstream);
        fstream.on('close', function () {
            console.log("Upload Finished of " + filename);

            extractDB(remoteAddress);

            res.redirect('back');
        });
    });
}

function extractDB(remoteAddress) {
    let keepFiles = [
        'podcastAddict.db',
        'com.bambuna.podcastaddict_preferences.xml'
    ];

    fs.createReadStream(`${baseUploadPath}${remoteAddress}.zip`)
        .pipe(unzipper.Parse())
        .pipe(stream.Transform({
            objectMode: true,
            transform: function(entry, e, cb) {
                const fileName = entry.path;
                const extension = fileName.split('.').pop();

                if (keepFiles.includes(fileName)) {
                    entry.pipe(fs.createWriteStream(`${baseDBPath}${remoteAddress}.${extension}`));
                    cb();
                } else {
                    entry.autodrain();
                    cb();
                }
            }
        })).on('finish', function() {
            console.log('Removing zip');
            fs.unlink(`${baseUploadPath}${remoteAddress}.zip`, (err) => {
                if (err) throw err;
            });

            alterDatabase();
        });
}

module.exports = function(app) {
    app.all('/api/*', function (req, res, next) {
        remoteAddress = req.connection.remoteAddress.replace(/[^\d\w]/g, '');
        next();
    });

    app.post('/api/upload', uploadFile);
};
