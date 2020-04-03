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
  { name: 'folder', type: String, defaultOption: true, description: 'The CSV data file folder (default - .csv)' },
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

var folder = 'csv';
var datetimeCols = [];
var dateformat = null;
var nodatetimefilter = false;

try{
	const options = commandLineArgs(optionDefinitions);

	if (options.help) {
		console.log(usage);
	} else {
		//app.log.info('options='+JSON.stringify(options));

		folder = options.folder || 'csv';
		datetimeCols = (options.datecols || 'date').split(',');
		dateformat = options.dateformat;
		nodatetimefilter = options.nodatetimefilter;

		if (fs.statSync(folder).isDirectory()){
			app.listen(4000, err => {
				if (err) {
					app.log.error(err);
					process.exit(1);
				}

				app.log.info('server listening on port ${app.server.address().port}');
			});
		}
		else {
			app.log.error ('folder [' + folder + '] not found');
		}
	}
}
catch(err){
	app.log.error(err.message);
	console.log(usage);
}


app.get('/', function (request, reply) {
	app.log.info('Testing GET called...');
	reply.send();
});


app.post('/search', (request, reply) => {
//	app.log.info(request.body);

	fs.readdir(folder, function(err, filenames) {
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
//			result.push(val);
//			if (result.length == request.body.targets.length)
//				reply.send(result);
			reply.send(val);
		}).catch(function(reason) {
			app.log.error(reason);
		});
	});
});

async function query(target) {// jshint ignore:line
	var filename = folder + '/' + target.target;
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

//	app.log.info(target.dateRange);
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

	let results = [];
	results.push(result);
	return results;
}

function parseGrafanaTimeseriesRecordSet(target, json){
	var format = dateformat;
	if (target.data && target.data.dateformat)
		format = target.data.dateformat;

	var nofilter = nodatetimefilter;
	if (target.data && target.data.nodatetimefilter)
		nofilter = target.data.nodatetimefilter;

	var datetimecols = datetimeCols;
	if (target.data && target.data.datetimecols)
		datetimecols = target.data.datetimecols.split(',');

	let cols = Object.keys(json[0]);

	// find datetime column
	let dateCol = 0;
	cols.forEach((col, i) => {
		datetimecols.forEach((n) => { if (col===n) dateCol = i; });
	});
//	app.log.info('cols='+JSON.stringify(cols));
//	app.log.info('datetimecols='+JSON.stringify(datetimecols));
//	app.log.info('dateCol='+dateCol);

	var results = [];
	let valueCols = [];
	cols.filter((col)=>{ return col!==cols[dateCol];}).forEach((col, i) => {
		valueCols.push(cols.findIndex((c) => {return c===col;}));
		let result = {};
		result.target = col;
		result.datapoints = [];
		results.push(result);
	});

	const from = new moment(target.dateRange.from);
	const to   = new moment(target.dateRange.to);

	json.forEach(function(row, i){
		let values = Object.keys(row).map(function(key){return row[key]; });

		let sdatetime = values[dateCol];
		let datetime = format ? new moment(sdatetime, format) : new moment(sdatetime);

//		app.log.info('row['+i+']('+sdatetime+'=>'+datetime+') = '+JSON.stringify(values));

		if (nofilter || (datetime >= from && datetime <= to)){
			valueCols.forEach((valueCol, i) => {
				results[i].datapoints.push([Number(values[valueCol]), datetime.valueOf()]);
			});
		}
	});

  return results;
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
