const fs = require('fs');
const path = require('path');
const stream = require('stream');
const unzipper = require('unzipper');

const baseUploadPath = path.resolve(__dirname) + '/../uploads/';
const baseDBPath = path.resolve(__dirname) + '/../dbs/';

function uploadFile(req, res, next) {
    let fstream;
    let formFields = {};

    let remoteAddress = req.connection.remoteAddress.replace(/[^\d\w]/g, '');

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
                    console.log(fileName);
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
        });
}

module.exports = function(app) {
    app.post('/api/upload', uploadFile);
};
