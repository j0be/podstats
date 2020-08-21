const bodyParser = require('body-parser');
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
    fs.createReadStream(`${baseUploadPath}${remoteAddress}.zip`)
        .pipe(unzipper.Parse())
        .pipe(stream.Transform({
            objectMode: true,
            transform: function(entry, e, cb) {
                const fileName = entry.path;
                if (fileName === "podcastAddict.db") {
                    entry.pipe(fs.createWriteStream(`${baseDBPath}${remoteAddress}.db`))
                        .on('finish', function() {
                            fs.unlink(`${baseUploadPath}${remoteAddress}.zip`, (err) => {
                                if (err) throw err;
                            });
                        });
                } else {
                    entry.autodrain();
                    cb();
                }
            }
        }));
}


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

    app.post('/api/upload', uploadFile);
};