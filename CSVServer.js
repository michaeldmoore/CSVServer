/*jshint esversion: 6 */
const app = require('fastify')(
	{
		logger: {
			prettyPrint: true
		}
	});

const args = require('minimist')(process.argv.slice(2));

const fs = require('fs');

const csv = require('csvtojson');

const moment = require('moment');

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const optionDefinitions = [
  { name: 'csvfolder', type: String, defaultOption: true, description: 'The CSV data file folder (default - .csv)' },
  { name: 'datecols', type: String, multiple: true, description: 'comma seperated list of date field headers'},
  { name: 'dateformat', type: String, description: 'date parsing format (e.g. dd/mm/yyyy HH:mm:ss - see {underline https://devhints.io/moment#formatting-1})' },
  { name: 'nodatetimefilter', type: Boolean, description: 'do not filter time series data by query date/time range)' },
];

const usage = commandLineUsage([
	{
		header: 'CSVServer',
		content: 'Front end data source for Grafana with SimpleJSON'
	},
	{
    header: 'Synopsis',
    content: '$ node CSVServer.js <options>'
	},
	{
		header: 'Options',
		optionList: optionDefinitions
	},
	{
		content: 'Project home: {underline https://github.com/michaeldmoore/CSVServer}'
	}
]);

var dataDirectory = 'csv';
var datetimeCols = [];
var dateformat = null;
var nodatetimefilter = false;

try{
	const options = commandLineArgs(optionDefinitions);

	if (options.help) {
		console.log(usage);
	} else {
//		app.log.info(options);

		dataDirectory = options.csvfolder || 'csv';
		datetimeCols = (options.datecols || 'date').split(',');
		dateformat = options.dateformat;
		nodatetimefilter = options.nodatetimefilter;

		if (fs.statSync(dataDirectory).isDirectory()){
			app.listen(4000, err => {
				if (err) {
					app.log.error(err);
					process.exit(1);
				}

				app.log.info('server listening on port ${app.server.address().port}');
			})
		}
		else {
			app.log.error ('CSV data directory [' + dataDirectory + '] not found');
		}
	}
}
catch(err){
	app.log.error(err.message);
	console.log(usage);
}

function checkDirectory(dir){
	fs.statSync(dir, function (err, stats){
		if (err) {
			throw err;
		}
		if (!stats.isDirectory()) {
			throw new Error(dir + ' is not a directory');
		};
	});
}

app.get('/', function (request, reply) {
	app.log.info('Testing GET called...');
	reply.send();
});


app.post('/search', (request, reply) => {
	app.log.info(request.body);

	fs.readdir(dataDirectory, function(err, filenames) {
		if (err) {
			app.log.error(err);
		}
		else {
			reply.send( filenames );
		}
	});
});

app.post('/query', function (request, reply) {
	var result = [];

	request.body.targets.forEach(function(target) {
		target.dateRange = request.body.range;
		target.maxDataPoints = request.body.maxDataPoints;
		var p = new Promise(function(resolve, reject) {
			query(target).then(function(data){
				resolve(data);
			});
		});
		p.then(function(val) {
			result.push(val);
			if (result.length == request.body.targets.length)
				reply.send(result);
		}).catch(function(reason) {
			app.log.error(reason);
		});
	});
});

async function query(target) {// jshint ignore:line
	var filename = dataDirectory + '/' + target.target;
	var json = await csv()// jshint ignore:line
		.fromFile(filename, {headers : true, trim: true});

	if (target.type == 'table')
		return parseGrafanaTableRecordSet(target, json);
	else
		return parseGrafanaTimeseriesRecordSet(target, json);
}

function parseGrafanaTableRecordSet(target, json){
	var result = {};

	//app.log.info(json);
	result.type = target.type;
	result.datetimeCols = [];
	result.columns = [];
	Object.keys(json[0]).forEach(function(colName){
		var col = {};
		col.text = colName;
		col.type = colName == 'value' ? 'number' : 'string';

		// Extension - try to detect datetime column names
		if (isDatetimeCol(colName))
		{
			result.datetimeCols.push(colName);
			col.type = 'time';
		}
		result.columns.push(col);
	});

	if (result.datetimeCols.length > 0)
		result.datetimeCol = result.datetimeCols[0];

	app.log.info(target.dateRange);
//app.log.info(target.maxDataPoints);
	result.rows = [];
	json.forEach(function(row){
		var array = Object.keys(row).map(function(key){return row[key]; });
//		var isDatetimeInRange = true;
		for(var i = 0; i < result.columns.length; i++)
		{
			if (result.columns[i].type == 'number')
				array[i] = Number(array[i]);

			//if (result.columns[i].text == result.datetimeCol)
				//isDatetimeInRange = !IsDateTimeInRange(array[i], target.dateRange);
		}
//		if (isDatetimeInRange)
			result.rows.push(array);
	});

	// trim excess rows (retaining the latest)
	var excessRows = result.rows.length - target.maxDataPoints;
	if (excessRows > 0)
		result.rows.splice(0, excessRows);

	return result;
}

function parseGrafanaTimeseriesRecordSet(target, json){

	app.log.info(target);

	var result = {};
	result.target = Object.keys(json[0])[1];
	result.datapoints = [];

	const from = new moment(target.dateRange.from);
	const to   = new moment(target.dateRange.to);

	json.forEach(function(row){
		var array = Object.keys(row).map(function(key){return row[key]; });
		var sdatetime = array[0];

		var datetime = new moment(sdatetime, dateformat);

		if (nodatetimefilter || (datetime >= from && datetime <= to))
			result.datapoints.push([Number(array[1]), datetime.valueOf()]);
		});

console.log(JSON.stringify(result));
    return result;
}

// Extension - try to detect datetime column names
function isDatetimeCol(colName){
	var rVal = false;

	datetimeCols.forEach(function(datetimeCol) {
		if (colName.includes(datetimeCol))
			rVal = true;
	});
	return rVal;
}
