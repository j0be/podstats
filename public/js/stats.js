$(document).ready(function() {
    getSummary();
    $('#interval')
        .change(getChart)
        .change();
    // $.post('/api/stats/podcast');
});

const minuteLength = 60 * 1000;
const hourLength = 60 * minuteLength;
const dayLength = 24 * hourLength;

function prettyDate(milliseconds) {
    if (milliseconds > dayLength) {
        let days = Math.floor(milliseconds / dayLength);
        let hours = Math.floor((milliseconds - (days * dayLength)) / hourLength);
        return `${days} days ${hours} hours`;
    } else if (milliseconds > hourLength) {
        let hours = Math.floor(milliseconds / hourLength);
        let minutes = Math.floor((milliseconds - (hours * hourLength)) / minuteLength);
        return `${hours} hours ${minutes} minutes`;
    } else if (milliseconds > minuteLength) {
        let minutes = Math.floor(milliseconds / minuteLength);
        let seconds = Math.floor((milliseconds - (minutes * minuteLength)) / 1000);
        return `${minutes} minutes ${seconds} seconds`;
    } else {
        let seconds = Math.floor(milliseconds / 1000);
        return `${seconds} seconds`;
    }
}

function getSummary() {
    $.ajax({
        type: "POST",
        url: '/api/stats/total',
        dataType: 'json',
        success: function(data) {
            $('#summary').append('<table>');
            $('#summary table').append(`<tr><td>Podcast Addict Total Time:</td><td>${prettyDate(data.pa.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Listened Episode Total Time:</td><td>${prettyDate(data.db.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Listened Episode Speed Adjusted Total Time:</td><td>${prettyDate(data.db.adjusted_time)}</td></tr>`);
        }
    });
}

function getChart() {
    let interval = $('#interval').val();
    $.ajax({
        type: "POST",
        url: `/api/stats/time?interval=${interval}`,
        dataType: 'json',
        success: function(data) {
            google.charts.load('current', { 'packages': ['corechart'] });
            google.charts.setOnLoadCallback(drawChart.bind(this, data));
        }
    });
}

function drawChart(serverData) {
    var dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Year');
    dataTable.addColumn('number', 'Playback Time');
    dataTable.addColumn({type: 'string', role: 'tooltip'});
    let intervalKey = $('#interval').val();
    let intervalMapper = {
        year: ['YYYY', 'YYYY'],
        month: ['YYYY-MM', 'MMMM YYYY'],
        week: ['YYYY-MM-WW', 'YYYY[: week] WW'],
        day: ['YYYY-MM-DD', 'MMMM D, YYYY']
    };

    serverData.forEach(function(interval) {
        let labelKey = intervalKey === 'week' ?
            interval.date_key.replace('w', '') :
            interval.group_key;
        let label = moment(String(labelKey), intervalMapper[intervalKey][0]).format(intervalMapper[intervalKey][1]);

        dataTable.addRow([
            label,
            Math.round((interval.total_time / hourLength) * 10)/10,
            `${label}\n${prettyDate(interval.total_time)}`
        ]);
    });

    var options = {
        legend: 'none',
        vAxis: {
            minValue: 0
        }
    };

    var chart = new google.visualization.AreaChart(document.getElementById('chart_div'));
    chart.draw(dataTable, options);
}