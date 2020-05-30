let chai = require("chai");
let chaiHttp = require("chai-http");
let server = require("../CSVServer");

// Assertion style
chai.should();

chai.use(chaiHttp);

describe("CSVServer api", () => {

    describe("GET /", () => {
        it("It should respond status of 200", (done) => {
            chai.request(server)
                .get("/")
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                })
        })
    })

    describe("POST /search", () => {
        it("It should respond with a list of 6 csv files", (done) => {
            chai.request(server)
                .post("/search")
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(6);

                    done();
                })
        })
    })

    describe("POST /query (table)", () => {
        it("It should return a table dataset", (done) => {
            const options = {
                "range": { "from": "2020-01-01", "to": "2020-05-30"},
                "targets": [ {
                "type": "table",
                "target": "test3.csv"
                }]
              };
            chai.request(server)
                .post("/query")
                .send(options)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(1);
                    let body0 = res.body[0];
                    body0.should.be.a('Object');
                    body0.should.have.property("type");
                    body0.should.have.property("columns");
                    body0.columns.should.have.length(4);

                    done();
                })
        })
    })

    describe("POST /query (timeseries)", () => {
        it("It should return a 3 timeseries dataset from a single triple-valued csv file request", (done) => {
            const options = {
                "range": { "from": "2020-01-01", "to": "2020-05-30"},
                "targets": [ {
                "target": "humidity.csv"
                }]
              };
            chai.request(server)
                .post("/query")
                .send(options)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(3);
                    res.body.forEach((target, index) => {
//                        console.log('target['+index+']='+JSON.stringify(target));
                        target.should.be.a('Object');
                        target.should.not.have.property("type");
                        target.should.not.have.property("columns");
                    });

                    done();
                })
        })
    })

    describe("POST /query (timeseries)", () => {
        it("It should return a timeseries dataset", (done) => {
            const options={"app":"dashboard","requestId":"Q102","timezone":"browser","panelId":23763571993,"dashboardId":3,"range":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z","raw":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z"}},"timeInfo":"","interval":"20s","intervalMs":20000,"targets":[{"data":null,"target":"temperature-ISO.csv","refId":"A","hide":false,"type":"timeseries"}],"maxDataPoints":846,"scopedVars":{"__interval":{"text":"20s","value":"20s"},"__interval_ms":{"text":"20000","value":20000}},"startTime":1590836091370,"rangeRaw":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z"},"adhocFilters":[]}; 
            chai.request(server)
                .post("/query")
                .send(options)
                .end((err, res) => {
//                    console.log('res.body=<<'+JSON.stringify(res.body)+'>>');
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(1);
                    res.body.forEach((target, index) => {
//                        console.log('target['+index+']='+JSON.stringify(target));
                        target.should.be.a('Object');
                        target.should.not.have.property("type");
                        target.should.not.have.property("columns");
                    });

                    done();
                })
        })
    })


    describe("POST /query (timeseries)", () => {
        it("It should return a 2 timeseries dataset, each from a single valued csv file request", (done) => {
            const options={"app":"dashboard","requestId":"Q101","timezone":"browser","panelId":23763571993,"dashboardId":3,"range":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z","raw":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z"}},"timeInfo":"","interval":"20s","intervalMs":20000,"targets":[{"data":null,"target":"temperature-ISO.csv","refId":"A","hide":false,"type":"timeseries"},{"data":{"dateformat":"DD-MM-YYYY HH:mm:ss"},"target":"temperature-UK.csv","refId":"B","hide":false,"type":"timeseries"}],"maxDataPoints":846,"scopedVars":{"__interval":{"text":"20s","value":"20s"},"__interval_ms":{"text":"20000","value":20000}},"startTime":1590837780339,"rangeRaw":{"from":"2020-05-20T08:29:58.610Z","to":"2020-05-20T13:06:26.096Z"},"adhocFilters":[]};
            chai.request(server)
                .post("/query")
                .send(options)
                .end((err, res) => {
//                    console.warn('res.body=<<'+JSON.stringify(res.body)+'>>');
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(2);
                    res.body.forEach((target, index) => {
//                        console.log('target['+index+']='+JSON.stringify(target));
                        target.should.be.a('Object');
                        target.should.not.have.property("type");
                        target.should.not.have.property("columns");
                    });

                    done();
                })
        })
    })


})