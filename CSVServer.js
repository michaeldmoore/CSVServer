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

const dataDirectory = args.dataDirectory ? args.dataDirectory : 'csv';

const datetimeCols = args.datetimeCols ? args.datetimeCols.split(',') : ['date'];

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

	return parseGrafanaRecordSet(target, json);
}

function parseGrafanaRecordSet(target, json)
{
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
		var isDatetimeInRange = true;
		for(var i = 0; i < result.columns.length; i++)
		{
			if (result.columns[i].type == 'number')
				array[i] = Number(array[i]);
			
			//if (result.columns[i].text == result.datetimeCol)
				//isDatetimeInRange = !IsDateTimeInRange(array[i], target.dateRange);
		}
		//array[3] = Number(array[3]);
		if (isDatetimeInRange)
			result.rows.push(array);
	});
	
	// trim excess rows (retaining the latest)
	var excessRows = result.rows.length - target.maxDataPoints;
	if (excessRows > 0)
		result.rows.splice(0, excessRows);
		
	return result;
}

function IsDateTimeInRange(datetime, datetimeRange)
{
	return true;
}

function parseGrafanaTimeseriesRecordSet(target, json){
	
	app.log.info(target);
	
	var result = {};
	result.target = Object.keys(json[0])[1];
	result.datapoints = [];

	json.forEach(function(row){
		var array = Object.keys(row).map(function(key){return row[key]; });
		var dataPoint = [];
		dataPoint[0] = array[1];
		dataPoint[1] = new Date(array[0]).getTime();
		result.datapoints.push(dataPoint);
		});
	
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

app.listen(4000, err => {
	if (err) {
		app.log.error(err);
		process.exit(1);
	}

	app.log.info('server listening on port ${app.server.address().port}');
});
