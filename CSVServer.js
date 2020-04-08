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
  { name: 'port', type: Number, description: 'server listening port (defaulting to 4000)' },
  { name: 'folder', type: String, defaultOption: true, description: 'The CSV data file folder (default - .csv)'},
  { name: 'datecols', type: String, multiple: true, description: 'comma seperated list of date field headers'},
  { name: 'dateformat', type: String, description: 'date parsing format (e.g. dd/mm/yyyy HH:mm:ss - see {underline https://devhints.io/moment#formatting-1})'},
  { name: 'datetimefilter', type: String, description: "use query range [to|from|both|none] default=none"},
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
var datetimefilter = 'none';

try{
	const options = commandLineArgs(optionDefinitions);

	if (options.help) {
		console.log(usage);
	} else {
		//app.log.info('options='+JSON.stringify(options));

		folder = options.folder || 'csv';
		datetimeCols = (options.datecols || 'date').split(',');
		dateformat = options.dateformat;
		datetimefilter = options.datetimefilter || datetimefilter;

		if (fs.statSync(folder).isDirectory()){
			app.listen(options.port || 4000, err => {
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
			reply.send(val);
		}).catch(function(reason) {
			app.log.error(reason);
		});
	});
});

async function query(target) {// jshint ignore:line
	let filename = folder + '/' + target.target;
	let json = await csv()// jshint ignore:line
		.fromFile(filename, {headers : true, trim: true});

	let format = dateformat;
	if (target.data && target.data.dateformat)
		format = target.data.dateformat;

	let filter = datetimefilter;
	if (target.data && target.data.datetimefilter)
		filter = target.data.datetimefilter;

	let datetimecols = datetimeCols;
	if (target.data && target.data.datetimecols)
		datetimecols = target.data.datetimecols.split(',');

		let cols = Object.keys(json[0]);

	// find datetime column
	let dateCol = 0;
	let dateColName;
	cols.forEach((colName, i) => {
		datetimecols.forEach((name) => {
			if (!dateColName && colName===name) {
				dateColName=colName;
				dateCol = i;
			}
		});
	});


	if (target.type == 'table')
		return parseGrafanaTableRecordSet(target, json, format, filter, cols, dateCol, datetimecols);
	else
		return parseGrafanaTimeseriesRecordSet(target, json, format, filter, cols, dateCol);
}

function parseGrafanaTableRecordSet(target, json, format, filter, cols, dateCol, datetimecols){
	let result = {type: target.type, columns: [], datetimeCols: []};
	cols.forEach(function(colName){
		let col = {text: colName, type: colName == 'value' ? 'number' : 'string'};

		if (datetimecols.find((d)=>d===colName))
		{
			result.datetimeCols.push(colName);
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

						console.log("sdatetime="+sdatetime+', filter='+filter+', >=from:'+(datetime >= from)+', <=to:'+(datetime <= to)+', isDatetimeInRange:'+isDatetimeInRange+
							", from="+from+', datetime='+datetime+', to='+to);
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
console.log('result.rows.length='+result.rows.length+', excessRows='+excessRows);
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

	datetimeCols.forEach(function(datetimeCol) {
		if (colName.includes(datetimeCol))
			rVal = true;
	});
	return rVal;
}
