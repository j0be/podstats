$(document).ready(function() {
    getSummary();
    $('#interval, #published, .incrementType, #useAdjusted')
        .change(getChart);
    getChart();

    $('#start_date').parent().next('a').click(autofillDate);
    $('#end_date').parent().next('a').click(autofillDate);
});

const minuteLength = 60 * 1000;
const hourLength = 60 * minuteLength;
const dayLength = 24 * hourLength;

let format = {
    pluralize: function pluralize(number, string) {
        return `${number} ${string}${number - 1 ? 's' : ''}`;
    },
    prettyDate: function prettyDate(milliseconds) {
        if (!milliseconds || milliseconds < 0) {
            return '0';
        } else if (milliseconds >= dayLength) {
            let days = Math.floor(milliseconds / dayLength);
            let hours = Math.floor((milliseconds - (days * dayLength)) / hourLength);
            return `${days && format.pluralize(days, 'day') || ''} ${hours && format.pluralize(hours, 'hour') || ''}`;
        } else if (milliseconds >= hourLength) {
            let hours = Math.floor(milliseconds / hourLength);
            let minutes = Math.floor((milliseconds - (hours * hourLength)) / minuteLength);
            return `${hours && format.pluralize(hours, 'hour') || ''} ${minutes && format.pluralize(minutes, 'minute') || ''}`;
        } else if (milliseconds >= minuteLength) {
            let minutes = Math.floor(milliseconds / minuteLength);
            let seconds = Math.floor((milliseconds - (minutes * minuteLength)) / 1000);
            return `${minutes && format.pluralize(minutes, 'minute') || ''} ${seconds && format.pluralize(seconds, 'second') || ''}`;
        } else {
            let seconds = Math.floor(milliseconds / 1000);
            return format.pluralize(seconds, 'second');
        }
    },
    percent: function percent(number) {
        return format.round(number * 100) + '%';
    },
    round: function round(number) {
        return Math.round(number * 10) / 10;
    },
    comma: function comma(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
};

let interval_mapper = {
    year: ['YYYY', 'YYYY'],
    month: ['YYYY-MM', 'MMMM YYYY'],
    week: ['YYYY-MM-DD', 'MMMM D, YYYY'],
    day: ['YYYY-MM-DD', 'MMMM D, YYYY']
};

function getSummary() {
    $.ajax({
        type: "POST",
        url: '/api/stats/total',
        dataType: 'json',
        success: function(data) {
            $('#summary').append('<table>');
            $('#summary table').append(`<tr><td>Podcast Addict Total Time:</td><td>${format.prettyDate(data.pa.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Listened Episode Total Time:</td><td>${format.prettyDate(data.db.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Listened Episode Speed Adjusted Total Time:</td><td>${format.prettyDate(data.db.adjusted_time)}</td></tr>`);
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

function getIntervalData(serverData, interval_key) {
    let threshold_low = moment($('#start_date').val(), 'YYYY-MM-DD');
    let threshold_high = moment($('#end_date').val(), 'YYYY-MM-DD');

    let first_total_label = serverData[0].group_key;
    let first_played_label = serverData.find(function(interval) {
        return interval.playback_time > 0 || interval.playback_count > 0;
    }).group_key;
    let last_label = serverData[serverData.length - 1].group_key;

    let first_total_date = moment(String(first_total_label.split('-').slice(0,3)), interval_mapper[interval_key][0]);
    let first_playback_date = moment(String(first_played_label.split('-').slice(0,3)), interval_mapper[interval_key][0]);
    let last_date = moment(String(last_label.split('-').slice(0,3)), interval_mapper[interval_key][0]);

    if (interval_key === 'week') {
        first_total_date.subtract(first_total_label.split('-').pop(), 'weeks');
        first_playback_date.subtract(first_played_label.split('-').pop(), 'weeks');
        last_date.subtract(last_label.split('-').pop(), 'weeks');
    }

    threshold_low_total = threshold_low._isValid ? threshold_low : first_total_date;
    threshold_low_playback = threshold_low._isValid ? threshold_low : first_playback_date;
    threshold_high = threshold_high._isValid ? threshold_high : last_date;

    let total_intervals = last_date.diff(moment.max(first_total_date, threshold_low_total), `${interval_key}s`);
    let playback_intervals = last_date.diff(moment.max(first_playback_date, threshold_low_playback), `${interval_key}s`);

    return {
        threshold_low: threshold_low_total,
        threshold_high: threshold_high,
        first_total_date: first_total_date,
        first_playback_date: first_playback_date,
        last_date: last_date,
        total_intervals: total_intervals,
        playback_intervals: playback_intervals,
    };
}

function drawChart(serverData) {
    let showPublished = $('#published').is(':checked');
    let useAdjusted = $('#useAdjusted').is(':checked');
    let incrementType = $('.incrementType:checked').val();
    let isCumulative = incrementType === 'cumulative' || incrementType === 'remaining';
    let isRemaining = incrementType === 'remaining';

    let interval_key = $('#interval').val();
    let intervalData = getIntervalData(serverData, interval_key);
    var dataTable = new google.visualization.DataTable();

    dataTable.addColumn({type: 'date', label: 'Year'});
    if (isRemaining) {
        dataTable.addColumn({type: 'number', format: 'decimal', label: 'Remaining Time'});
        dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});
    } else {
        dataTable.addColumn({type: 'number', format: 'decimal', label: 'Playback Time'});
        dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});

        if (showPublished) {
            dataTable.addColumn({type: 'number', format: 'decimal', label: 'Published Time'});
            dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});
        }
    }

    let total_milliseconds,
        total_count,
        playback_milliseconds,
        playback_count;

    let cumlativeTotals = {
        total_time_adjusted: 0,
        total_time: 0,
        total_count: 0,
        playback_time_adjusted: 0,
        playback_time: 0,
        playback_count: 0
    };

    serverData.forEach(function(interval) {
        let labelKey = interval.group_key.split('-').slice(0,3);
        let date = moment(String(labelKey), interval_mapper[interval_key][0]);
        let label = date.format(interval_mapper[interval_key][1]);

        if (interval_key === 'week') {
            date.subtract(interval.group_key.split('-').pop(), 'weeks');
            let end_date = moment(date).add('6', 'days');

            let date_format = date.year() !== end_date.year() ?
                'MMMM D, YYYY [-] ' :
                'MMMM D [-] ';
            let end_format = date.month() !== end_date.month() ?
                'MMMM D, YYYY' :
                'D, YYYY';

            label = date.format(date_format) +
                end_date.format(end_format);
        }


        let isBefore = date.isBefore(intervalData.threshold_low);
        let isAfter = date.isAfter(intervalData.threshold_high);
        let isInRange = !isBefore && !isAfter;
        if (isInRange) {
            let rowData = [
                date._d
            ];

            Object.keys(cumlativeTotals).forEach(function(key) {
                cumlativeTotals[key] += Math.max(interval[key] || 0, 0) ;
            });

            if (isCumulative) {
                total_milliseconds = useAdjusted ? cumlativeTotals.total_time_adjusted : cumlativeTotals.total_time;
                total_count = cumlativeTotals.total_count;
                playback_milliseconds = useAdjusted ? cumlativeTotals.playback_time_adjusted : cumlativeTotals.playback_time;
                playback_count = cumlativeTotals.playback_count;
            } else {
                total_milliseconds = Math.max((useAdjusted ? interval.total_time_adjusted : interval.total_time) || 0, 0);
                total_count = interval.total_count || 0;
                playback_milliseconds = Math.max((useAdjusted ? interval.playback_time_adjusted : interval.playback_time) || 0, 0);
                playback_count = interval.playback_count || 0;
            }

            if (isRemaining) {
                let remaining_milliseconds = total_milliseconds - playback_milliseconds;
                let remaining_count = total_count - playback_count;
                rowData = rowData.concat([
                    remaining_milliseconds / hourLength,
                    `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                        <h3 style="margin-top: 0">${label}</h3>
                        Remaining Episodes: ${remaining_count} (${format.percent(remaining_count / (total_count || 1))})<br/>
                        Remaining Time: ${format.prettyDate(remaining_milliseconds)} (${format.percent(remaining_milliseconds / (total_milliseconds || 1))})
                    </div>`
                ]);
            } else {
                if (showPublished || interval.playback_time > 0 || interval.playback_count > 0) {
                    rowData = rowData.concat([
                        (playback_milliseconds + 1) / hourLength,
                        `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                            <h3 style="margin-top: 0">${label}</h3>
                            Played Episodes: ${playback_count} (${format.percent(playback_count / (total_count || 1))})<br/>
                            Playback Time: ${format.prettyDate(playback_milliseconds)} (${format.percent(playback_milliseconds / (total_milliseconds || 1))})
                        </div>`
                    ]);
                }

                if (showPublished) {
                    rowData = rowData.concat([
                        total_milliseconds / hourLength,
                        `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                            <h3 style="margin-top: 0">${label}</h3>
                            Published Episodes: ${total_count}<br/>
                            Published Time: ${format.prettyDate(total_milliseconds)}
                        </div>`
                    ]);
                }
            }

            if (rowData.length > 1) {
                dataTable.addRow(rowData);
            }
        }
    });

    var options = {
        series: {
            0: { color: '#480' },
            1: { color: '#09f' },
        },
        tooltip: {
            isHtml: true
        },
        vAxis: {
            minValue: 0
        }
    };

    var chart = new google.visualization.AreaChart(document.getElementById('chart_div'));
    chart.draw(dataTable, options);

    //
    $('#compare').html('<table></table>');
    $('#compare table').append(`<tr><td>Total published time:</td><td>${format.prettyDate(cumlativeTotals.total_time)}</td></tr>`);
    $('#compare table').append(`<tr><td>Total published episodes:</td><td>${format.comma(format.round(cumlativeTotals.total_count))}</td></tr>`);
    $('#compare table').append(`<tr><td>Total playback time:</td><td>${format.prettyDate(cumlativeTotals.playback_time)}</td></tr>`);
    $('#compare table').append(`<tr><td>Total played episodes:</td><td>${format.comma(format.round(cumlativeTotals.playback_count))}</td></tr>`);
    $('#compare table').append(`<tr><td>Avg published time:</td><td>${format.prettyDate(cumlativeTotals.total_time / intervalData.total_intervals)}</td></tr>`);
    $('#compare table').append(`<tr><td>Avg published episodes:</td><td>${format.comma(format.round(cumlativeTotals.total_count / intervalData.total_intervals))}</td></tr>`);
    $('#compare table').append(`<tr><td>Avg playback time:</td><td>${format.prettyDate(cumlativeTotals.playback_time / intervalData.playback_intervals)}</td></tr>`);
    $('#compare table').append(`<tr><td>Avg played episodes:</td><td>${format.comma(format.round(cumlativeTotals.playback_count / intervalData.playback_intervals))}</td></tr>`);

    //
    $('#start_date').attr('data-autodate', intervalData.first_playback_date.format('YYYY-MM-DD'));
    $('#end_date').attr('data-autodate', intervalData.last_date.format('YYYY-MM-DD'));
}

function autofillDate() {
    let target = $(this).prev().find('input');
    target.val(target.attr('data-autodate'));
}