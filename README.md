# CSVServer
Simple node-based CSV adapter for Grafana Simple JSON data source

This is a simple node application to read table or timeseries formatted CSV files as JSON, sutable for Granfana's SimpleJSON data source

This is intended for testing and demonstration purposes only - not recommended for production environments where efficiency and robustness are needed.



# Installation/setup
from a command window, execute the following commands:

```
git clone https://github.com/michaeldmoore/CSVServer.git

npm install

node CSVServer.js my-data-directory
```

or, using the default CSV data directory (csv)
```
node CSVServer.js
```


Note:  In this initial release, the date-range fiters used by Grafana are not used.  All the data in the CSV file is returend to the client - which might be inefficient in a real-world/production environment where data sets could become very large.


# Sample table formatted CSV file
```
datetime,sensor,region,value
2017-09-05 18:21:07.000,AAA,West,1.234
2017-09-05 21:18:42.000,AAA,West,1.234
2017-09-05 21:21:32.000,AAA,West,1.234
2018-04-17 10:39:12.000,AAA,West,1.234
2018-04-17 10:39:12.000,DDD,South,0.51
2017-09-05 21:18:42.000,EEE,West,0.9
2018-01-01 01:01:01.000,EEE,West,0.5
2018-04-17 10:39:12.000,EEE,West,0.3
2017-09-05 21:21:32.000,FFF,Central,0.160411622524645
2018-04-17 10:39:12.000,FFF,Central,0.838865293039815
```
Each row should have at least one numeric value column (though this can ba called anything).  Each row in the csv file will return a row in the JSON datasource, with the other columns available as named fields.  Generally, there will be a date/time field too, though this is not strictly necessary.

# Sample time-series formatted CSV file
```
date,temperature
2018-12-18 00:00:00.000,51.5
2018-12-18 01:00:00.000,56.2
2018-12-18 02:00:00.000,58.3
2018-12-18 03:00:00.000,62.4
2018-12-18 04:00:00.000,66.5
2018-12-18 05:00:00.000,70.6
2018-12-18 06:00:00.000,65.7
2018-12-18 07:00:00.000,45.8
```
Each row should have a date field, plus a single value field (again, these can be named anything - though individual panels might import some addition limitations on expected names etc.)


CSVServer runs as a HTTP (REST) server, on port 4000 (this can be changed by editting CSVServer.js).  Also, note that the current version is set to run on the localhost (ie, on the same server as Grafana itself).  Hosting CSVServer on a different server will most likely require a CORS header to be added to the source, and any firewalls configured to support it).  Adding secure HTTPS support would require a similar change.  No plans exist to build this support in - at least - not yet.


# Setting up Grafana SimpleJSON datasource to use CSVServer

The SimpleJSON datasource plugin needs to be installed first.  If not already installed, stop Grafana server and run the following command line (windows):
```
grafana-cli plugins install grafana-simple-json-datasource
```
Then restart Grafana server (See https://grafana.com/plugins/grafana-simple-json-datasource/installation for details, if needed)


Open Grafana as a client in a web browser and log in as usual (this may require admin rights within Grafana).  Select new data source, provide a data source name (CSVServer suggested) and define the type as SimpleJSON.
![showcase](https://user-images.githubusercontent.com/3724718/50186644-141f3f00-02e1-11e9-812f-94be59ea3d92.png)


Now define the URL to point to the node server, and click on 'Save & Test'
![showcase](https://user-images.githubusercontent.com/3724718/50186753-75471280-02e1-11e9-8382-68606c0a373f.png)


The SimpleJSON configuration screen has a number of other options which might be useful under certain circumstances - generally the defaults should work.


Once in operation, the CSV files can be updated dynamically - each data request from Grafana will cause the files to be re-parsed, so you should be able to see the effects immediately.


