$(document).ready(function() {
    $('#fileFormFile').change(uploadFile);
});

function uploadFile() {
    var fd = new FormData($('#fileForm')[0]);
    $('#fileInputLoadingOutput').text('Uploading');

    $.ajax({
        url: '/api/upload',
        type: 'POST',
        data: fd,
        cache: false,
        contentType: false,
        processData: false
    }).done(function() {
        $('#fileInputLoadingOutput').text('File uploaded!');
    }).fail(function() {
        $('#fileInputLoadingOutput').text('Failed to upload!');
    });
}