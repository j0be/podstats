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

let interval_mapper = {
    year: ['YYYY', 'YYYY'],
    month: ['YYYY-MM', 'MMMM YYYY'],
    week: ['YYYY-MM-DD', 'MMMM D, YYYY'],
    day: ['YYYY-MM-DD', 'MMMM D, YYYY']
};

let format = {
    pluralize: function pluralize(number, string) {
        return `${number} ${string}${number - 1 ? 's' : ''}`;
    },
    range: function(start_date, end_date) {
        let start_format = end_date.year() !== start_date.year() ?
            'MMMM D, YYYY [-] ' :
            'MMMM D [-] ';
        let end_format = end_date.month() !== start_date.month() ?
            'MMMM D, YYYY' :
            'D, YYYY';
        return start_date.format(start_format) +
            end_date.format(end_format)
    },
    timeFormat: function(milliseconds, format) {
        return moment.utc(moment().diff(moment().subtract(milliseconds, 'milliseconds'))).format(format);
    },
    prettyDate: function prettyDate(milliseconds, short) {
        if (!milliseconds) {
            return '0';
        } else if (milliseconds < 0) {
            return '-' + format.prettyDate(milliseconds*-1, short);
        } else if (milliseconds >= dayLength) {
            let days = Math.floor(milliseconds / dayLength);
            let hours = Math.floor((milliseconds - (days * dayLength)) / hourLength);
            let minutes = Math.floor((milliseconds - (days * dayLength) - (hours * hourLength)) / minuteLength);

            return short ?
                `${days}d ${format.timeFormat(milliseconds - (days * dayLength), 'HH:mm:ss')}` :
                `${format.pluralize(days, 'day') || ''} ${format.pluralize(hours, 'hour') || ''} ${minutes && format.pluralize(minutes, 'minute') || ''}`;
        } else if (milliseconds >= hourLength) {
            let hours = Math.floor(milliseconds / hourLength);
            let minutes = Math.floor((milliseconds - (hours * hourLength)) / minuteLength);
            return short ?
                format.timeFormat(milliseconds, 'H:mm:ss') :
                `${format.pluralize(hours, 'hour') || ''} ${minutes && format.pluralize(minutes, 'minute') || ''}`;
        } else if (milliseconds >= minuteLength) {
            let minutes = Math.floor(milliseconds / minuteLength);
            let seconds = Math.floor((milliseconds - (minutes * minuteLength)) / 1000);
            return short ?
                format.timeFormat(milliseconds, 'm:ss') :
                `${format.pluralize(minutes, 'minute') || ''} ${seconds && format.pluralize(seconds, 'second') || ''}`;
        } else {
            let seconds = Math.floor(milliseconds / 1000);
            return short ?
                format.timeFormat(milliseconds, 's') :
                format.pluralize(seconds, 'second');

            return ;
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

function getSummary() {
    $.ajax({
        type: "POST",
        url: '/api/stats/total',
        dataType: 'json',
        success: function(data) {
            $('#summary').append('<div><h2>Summary</h2><table></div>');
            $('#summary table').append(`<tr><th colspan="2">Podcast Addict</th></tr>`);
            $('#summary table').append(`<tr><td>Total Time:</td><td>${format.prettyDate(data.pa.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Radio Time:</td><td>${format.prettyDate(data.pa.radio_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Episode Count:</td><td>${format.comma(format.round(data.pa.read_episodes))}</td></tr>`);

            $('#summary table').append(`<tr><th colspan="2">Podstats</th></tr>`);
            $('#summary table').append(`<tr><td>Listened Episode Total Time:</td><td>${format.prettyDate(data.db.total_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Speed Adjusted Total Time:</td><td>${format.prettyDate(data.db.adjusted_time)}</td></tr>`);
            $('#summary table').append(`<tr><td>Episode Count:</td><td>${format.comma(format.round(data.db.total_count))}</td></tr>`);

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

    switch (interval_key) {
        case 'week':
            first_total_date.subtract(parseInt(first_total_label.split('-').pop()), 'weeks');
            first_playback_date.subtract(parseInt(first_played_label.split('-').pop()), 'weeks');
            last_date.subtract(parseInt(last_label.split('-').pop()), 'weeks');
            break;

        case 'month':
            threshold_high = threshold_high.endOf('month');
            last_date = last_date.endOf('month');
            break;
        case 'year':
            threshold_high = threshold_high.endOf('year');
            last_date = last_date.endOf('year');
            break;
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
    let interval_key = $('#interval').val();
    let intervalData = getIntervalData(serverData, interval_key);

    let cumulativeTotals = {
        total_time_adjusted: 0,
        total_time: 0,
        total_count: 0,
        playback_time_adjusted: 0,
        playback_time: 0,
        playback_count: 0,
        read_time_adjusted: 0,
        read_time: 0,
        read_count: 0
    };

    handleChartData(serverData, cumulativeTotals, intervalData);
    handleChartSummary(cumulativeTotals, intervalData);
}

function handleChartData(serverData, cumulativeTotals, intervalData) {
    let interval_key = $('#interval').val();
    let showPublished = $('#published').is(':checked');
    let useAdjusted = $('#useAdjusted').is(':checked');
    let incrementType = $('.incrementType:checked').val();
    let isCumulative = incrementType === 'cumulative' || incrementType === 'remaining';
    let isRemaining = incrementType === 'remaining';

    let total_milliseconds,
        total_count,
        playback_milliseconds,
        playback_count;

    var dataTable = new google.visualization.DataTable();

    dataTable.addColumn({type: 'date', label: 'Year'});
    if (isRemaining) {
        dataTable.addColumn({type: 'number', format: 'decimal', label: 'Remaining Time'});
        dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});
    } else {
        dataTable.addColumn({type: 'number', format: 'decimal', label: 'Playback Time'});
        dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});
        dataTable.addColumn({type: 'number', format: 'decimal', label: 'Read Time'});
        dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});

        if (showPublished) {
            dataTable.addColumn({type: 'number', format: 'decimal', label: 'Published Time'});
            dataTable.addColumn({type: 'string', role: 'tooltip', p: { html: true }});
        }
    }

    // for (let i = 0; i < intervalData.total_intervals; i ++) {

    // }

    serverData.forEach(function(interval) {
        let labelKey = interval.group_key.split('-').slice(0,3);
        let date = moment(String(labelKey), interval_mapper[interval_key][0]);
        let label = date.format(interval_mapper[interval_key][1]);

        if (interval_key === 'week') {
            date.subtract(interval.group_key.split('-').pop(), 'weeks');
            let start_date = moment(date).subtract('6', 'days');
            label = format.range(start_date, date);
        }

        let isBefore = date.isBefore(intervalData.threshold_low);
        let isAfter = date.isAfter(intervalData.threshold_high);
        let isInRange = !isBefore && !isAfter;
        if (isInRange) {
            let rowData = [
                date._d
            ];

            Object.keys(cumulativeTotals).forEach(function(key) {
                cumulativeTotals[key] += Math.max(interval[key] || 0, 0) ;
            });

            if (isCumulative) {
                total_milliseconds = useAdjusted ? cumulativeTotals.total_time_adjusted : cumulativeTotals.total_time;
                total_count = cumulativeTotals.total_count;
                read_milliseconds = useAdjusted ? cumulativeTotals.read_time_adjusted : cumulativeTotals.read_time;
                read_count = cumulativeTotals.read_count;
                playback_milliseconds = useAdjusted ? cumulativeTotals.playback_time_adjusted : cumulativeTotals.playback_time;
                playback_count = cumulativeTotals.playback_count;
            } else {
                total_milliseconds = Math.max((useAdjusted ? interval.total_time_adjusted : interval.total_time) || 0, 0);
                total_count = interval.total_count || 0;
                read_milliseconds = Math.max((useAdjusted ? interval.read_time_adjusted : interval.read_time) || 0, 0);
                read_count = interval.read_count || 0;
                playback_milliseconds = Math.max((useAdjusted ? interval.playback_time_adjusted : interval.playback_time) || 0, 0);
                playback_count = interval.playback_count || 0;
            }

            if (isRemaining) {
                let remaining_milliseconds = total_milliseconds - playback_milliseconds - read_milliseconds;
                let remaining_count = total_count - playback_count - read_count;
                rowData = rowData.concat([
                    remaining_milliseconds / hourLength,
                    `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                        <h3 style="margin-top: 0">${label}</h3>
                        Remaining Episodes: ${remaining_count} (${format.percent(remaining_count / (total_count || 1))})<br/>
                        Remaining Time: ${format.prettyDate(remaining_milliseconds)} (${format.percent(remaining_milliseconds / (total_milliseconds || 1))})
                    </div>`
                ]);
            } else {
                rowData = rowData.concat([
                    (playback_milliseconds + 1) / hourLength,
                    `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                        <h3 style="margin-top: 0">${label}</h3>
                        Played Episodes: ${playback_count} (${format.percent(playback_count / (total_count || 1))})<br/>
                        Playback Time: ${format.prettyDate(playback_milliseconds)} (${format.percent(playback_milliseconds / (total_milliseconds || 1))})
                    </div>`,
                    (read_milliseconds + 1) / hourLength,
                    `<div style="padding: 1em; font-family: Arial; font-size: 14px;">
                        <h3 style="margin-top: 0">${label}</h3>
                        Read Episodes: ${read_count} (${format.percent(read_count / (total_count || 1))})<br/>
                        Read Time: ${format.prettyDate(read_milliseconds)} (${format.percent(read_milliseconds / (total_milliseconds || 1))})
                    </div>`
                ]);

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
            0: { color: '#6432f9' },
            1: { color: '#80ea33' },
            2: { color: '#b7bac8' },
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

    // Add data for autofill
    $('#start_date').attr('data-autodate', intervalData.first_playback_date.format('YYYY-MM-DD'));
    $('#end_date').attr('data-autodate', intervalData.last_date.format('YYYY-MM-DD'));
}

function handleChartSummary(cumulativeTotals, intervalData) {
    let interval_key = $('#interval').val();

    let from_label = format.range(intervalData.threshold_low, intervalData.threshold_high);

    $('#chart_summary').html('');
    $('#chart_summary').append(`<div><div><h2>Total times</h2><div class="desc">from ${from_label}</div><table class="ttime"></table></div></div>`);
    $('#chart_summary table.ttime').append('<tr><th></th><th>Adjusted by speed</th><th>1.0x speed</th></tr>');

    $('#chart_summary table.ttime').append(`<tr>
        <td>Published time:</td>
        <td>${format.prettyDate(cumulativeTotals.total_time_adjusted, true)}</td>
        <td>${format.prettyDate(cumulativeTotals.total_time, true)}</td>
    </tr>`);
    $('#chart_summary table.ttime').append(`<tr>
        <td>Playback time:</td>
        <td>${format.prettyDate(cumulativeTotals.playback_time_adjusted, true)}</td>
        <td>${format.prettyDate(cumulativeTotals.playback_time, true)}</td>
    </tr>`);
    $('#chart_summary table.ttime').append(`<tr>
        <td>Read time:</td>
        <td>${format.prettyDate(cumulativeTotals.read_time_adjusted, true)}</td>
        <td>${format.prettyDate(cumulativeTotals.read_time, true)}</td>
    </tr>`);
    $('#chart_summary table.ttime').append(`<tr>
        <td>Remaining time:</td>
        <td>${format.prettyDate(cumulativeTotals.total_time_adjusted - cumulativeTotals.playback_time_adjusted - cumulativeTotals.read_time_adjusted, true)}</td>
        <td>${format.prettyDate(cumulativeTotals.total_time - cumulativeTotals.playback_time - cumulativeTotals.read_time, true)}</td>
    </tr>`);

    $('#chart_summary').append(`<div><div><h2>Total counts</h2><div class="desc">from ${from_label}</div><table class="tcount"></table></div></div>`);
    $('#chart_summary table.tcount').append(`<tr><td>Published episodes:</td><td>${format.comma(format.round(cumulativeTotals.total_count))}</td></tr>`);
    $('#chart_summary table.tcount').append(`<tr><td>Played episodes:</td><td>${format.comma(format.round(cumulativeTotals.playback_count))}</td></tr>`);
    $('#chart_summary table.tcount').append(`<tr><td>Read episodes:</td><td>${format.comma(format.round(cumulativeTotals.read_count))}</td></tr>`);
    $('#chart_summary table.tcount').append(`<tr><td>Remaining episodes:</td><td>${format.comma(format.round(cumulativeTotals.total_count - cumulativeTotals.playback_count - cumulativeTotals.read_count))}</td></tr>`);

    $('#chart_summary').append(`<div><div><h2>Averages</h2><div class="desc">per ${interval_key} from ${from_label}</div><table class="avg"></table></div></div>`);
    $('#chart_summary table.avg').append(`<tr><td>Avg published time:</td><td>${format.prettyDate(cumulativeTotals.total_time / intervalData.total_intervals)}</td></tr>`);
    $('#chart_summary table.avg').append(`<tr><td>Avg playback time:</td><td>${format.prettyDate(cumulativeTotals.playback_time / intervalData.total_intervals)}</td></tr>`);
    $('#chart_summary table.avg').append(`<tr><td>Avg published episodes:</td><td>${format.comma(format.round(cumulativeTotals.total_count / intervalData.total_intervals).toFixed(1))}</td></tr>`);
    $('#chart_summary table.avg').append(`<tr><td>Avg played episodes:</td><td>${format.comma(format.round(cumulativeTotals.playback_count / intervalData.total_intervals).toFixed(1))}</td></tr>`);
}

function autofillDate() {
    let target = $(this).prev().find('input');
    target.val(target.attr('data-autodate'));
}