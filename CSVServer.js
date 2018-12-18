const app = require('fastify')(
	{
		logger: {
			prettyPrint: true
		}
	})

var fs = require('fs');

var dataDirectory = process.argc > 2 ? process.argv[2] : 'csv';

var csv = require('csvtojson');

app.get('/', function (request, reply) {
	app.log.info('Testing GET called...');
})


app.post('/search', (request, reply) => {
	app.log.info(request.body);

	fs.readdir(dataDirectory, function(err, filenames) {
		if (err) {
			app.log.error(err)
		}
		else {
			reply.send( filenames )
		}
	});	
})

app.post('/query', function (request, reply) {
	var result = [];
	request.body.targets.forEach(function(target) {
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
})

async function query(target) {
	var filename = dataDirectory + '/' + target.target;

	var json = await csv()
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
	result.columns = [];
	Object.keys(json[0]).forEach(function(colName){
		var col = {};
		col.text = colName;
		col.type = colName == 'value' ? 'number' : 'string';
		//if (colName == 'date' || colName == 'datetime' || colName == "time")
		//	col.type = 'time';
		result.columns.push(col);
		});
	result.rows = [];
	json.forEach(function(row){
		var array = Object.keys(row).map(function(key){return row[key]; });
		array[3] = Number(array[3]);
		result.rows.push(array);
		});
		
	return result;
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


app.listen(4000, err => {
	if (err) {
		app.log.error(err)
		process.exit(1)	
	}

	app.log.info('server listening on port ${app.server.address().port}')
})
