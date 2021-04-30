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

const loadIniFile = require('read-ini-file');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');


const optionDefinitions = [
  { name: 'port', type: Number, description: 'server listening port (defaulting to 4000)' },
  { name: 'folder', type: String, defaultOption: true, description: 'The CSV data file folder (default - .csv)'},
  { name: 'datecols', type: String, multiple: true, description: 'comma seperated list of date field headers'},
  { name: 'dateformat', type: String, description: 'date parsing format (e.g. dd/mm/yyyy HH:mm:ss - see {underline https://devhints.io/moment#formatting-1})'},
  { name: 'datetimefilter', type: String, description: "use query range [to|from|both|none] default=none"},
  { name: 'configfile', type: String, description: "configuration filename (default=default.ini)"},
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

var port = 4000;
var folder = 'csv';
var datecols = [];
var dateformat = null;
var datetimefilter = 'none';

try{
	const commandlineOptions = commandLineArgs(optionDefinitions);
	const defaultOptions = loadIniFile.sync(commandlineOptions.configfile || './default.ini').options;

	if (commandlineOptions.help) {
		console.log(usage);
	} else {
		app.log.info('commandlineOptions='+JSON.stringify(commandlineOptions));
		app.log.info('defaultOptions='+JSON.stringify(defaultOptions));

		port = commandlineOptions.port || defaultOptions.port || port;
		folder = commandlineOptions.folder || defaultOptions.folder || folder;
		datecols = (commandlineOptions.datecols || defaultOptions.datecols || 'date').split(',');
		dateformat = commandlineOptions.dateformat || defaultOptions.dateformat;
		datetimefilter = commandlineOptions.datetimefilter || defaultOptions.datetimefilter || datetimefilter;

		if (fs.statSync(folder).isDirectory()){
			app.listen(port, '0.0.0.0', err => {
				if (err) {
					app.log.error(err);
					process.exit(1);
				}

				app.log.info('server listening on port ' + app.server.address().port);
			});
			module.exports = app.server;
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
//	console.log('body='+JSON.stringify(request.body));
	let thisFolder = folder;
	if (request.body && request.body.folder)
		thisFolder = request.body.folder;

	fs.readdir(thisFolder, function(err, filenames) {
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

//	console.log('body='+JSON.stringify(request.body, null, 4));

	var promises = [];

	request.body.targets.forEach(function(target, index) {
//		console.log('target['+index+']');
		if (target.target) {
			target.dateRange = request.body.range;
			target.maxDataPoints = request.body.maxDataPoints;
			var p = new Promise(function(resolve, reject) {
				query(target).then(function(data){
					resolve(data);
				});
			});
			promises.push(p);
		}
	});

	Promise.all(promises).then(function(val) {
//		console.log('val='+JSON.stringify(val));

		var result = [];
		val.forEach((vali, i) => {
//			console.log('val['+i+']='+JSON.stringify(vali));
			result = result.concat(vali);
		});
//		console.log('result='+JSON.stringify(result));

		reply.send(result);
	}).catch(function(reason) {
		app.log.error(reason);
	});

});

async function query(target) {// jshint ignore:line
	let thisFolder = folder;
	if (target.data && target.data.folder)
		thisFolder = target.data.folder;

	let filename = thisFolder + '/' + target.target;
	let json = await csv()// jshint ignore:line
		.fromFile(filename, {headers : true, trim: true});

	let format = dateformat;
	if (target.data && target.data.dateformat)
		format = target.data.dateformat;

	let filter = datetimefilter;
	if (target.data && target.data.datetimefilter)
		filter = target.data.datetimefilter;

	let dateCols = datecols;
	if (target.data && target.data.dateCols)
		datecols = target.data.dateCols.split(',');

	let cols = Object.keys(json[0]);

	// find datetime column
	let dateCol = 0;
	let dateColName;
	cols.forEach((colName, i) => {
		dateCols.forEach((name) => {
			if (!dateColName && colName===name) {
				dateColName=colName;
				dateCol = i;
			}
		});
	});


	if (target.type == 'table')
		return parseGrafanaTableRecordSet(target, json, format, filter, cols, dateCol, dateCols);
	else
		return parseGrafanaTimeseriesRecordSet(target, json, format, filter, cols, dateCol);
}

function parseGrafanaTableRecordSet(target, json, format, filter, cols, dateCol, dateCols){
	let result = {type: target.type, columns: [], dateCols: []};
	cols.forEach(function(colName){
		let col = {text: colName, type: colName == 'value' ? 'number' : 'string'};

		if (dateCols.find((d)=>d===colName))
		{
			result.dateCols.push(colName);
			col.type = 'time';
		}
		result.columns.push(col);
	});

	const from = new moment(target.dateRange.from);
	const to   = new moment(target.dateRange.to);

//	app.log.info(target.dateRange);
//app.log.info(target.maxDataPoints);
	result.rows = [];
	json.forEach(function(row){
		let array = Object.keys(row).map(function(key){return row[key]; });
		let isDatetimeInRange = true;
		for(let i = 0; i < result.columns.length; i++)
		{
			if (result.columns[i].type == 'number')
				array[i] = Number(array[i]);
			else if (result.columns[i].type == 'time'){
				let sdatetime = array[i];
				let datetime = format ? new moment(sdatetime, format) : new moment(sdatetime);

				if (i===dateCol){
					isDatetimeInRange =
						filter==='none' ||
						(filter==="to" && datetime <= to) ||
						(filter==="from" && datetime >= from) ||
						(filter==="both" && datetime >= from && datetime <= to);

//						console.log("sdatetime="+sdatetime+', filter='+filter+', >=from:'+(datetime >= from)+', <=to:'+(datetime <= to)+', isDatetimeInRange:'+isDatetimeInRange+
//							", from="+from+', datetime='+datetime+', to='+to);
				}
			}
		}

		if (isDatetimeInRange){
			result.rows.push(array);
//			console.log('Adding row.  result.rows.length='+result.rows.length);
		}
	});

	// trim excess rows (retaining the latest)
	var excessRows = result.rows.length - target.maxDataPoints;
//console.log('result.rows.length='+result.rows.length+', excessRows='+excessRows);
	if (excessRows > 0)
		result.rows.splice(0, excessRows);

	let results = [];
	results.push(result);
	//console.log('results='+JSON.stringify(results, null, 2));
	return results;
}

function parseGrafanaTimeseriesRecordSet(target, json, format, filter, cols, dateCol){
	let results = [];
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

		if (filter==='none' ||
			(filter==="to" && datetime <= to) ||
			(filter==="from" && datetime >= from) ||
			(filter==="both" && datetime >= from && datetime <= to)){
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

	dateCols.forEach(function(datetimeCol) {
		if (colName.includes(datetimeCol))
			rVal = true;
	});
	return rVal;
}

