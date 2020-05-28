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
        it("It should respond with a list of 3 csv files", (done) => {
            chai.request(server)
                .post("/search")
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.have.length(4);

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
//                "folder": "./test/csv",
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
//                    body0.type.should.be("table");
                    body0.should.have.property("columns");
                    body0.columns.should.have.length(4);
//                    body0.columns[2].should.be("region");

                    done();
                })
        })
    })

    describe("POST /query (timeseries)", () => {
        it("It should return a timeseries dataset", (done) => {
            const options = {
                "range": { "from": "2020-01-01", "to": "2020-05-30"},
                "targets": [ {
//                "folder": "./test/csv",
                "target": "humidity.csv"
                }]
              };
            chai.request(server)
                .post("/query")
                .send(options)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
//                    console.log(JSON.stringify(res.body));
                    res.body.should.have.length(3);
                    let target0 = res.body[0];
                    console.log(JSON.stringify(target0));
                    target0.should.be.a('Object');
                    target0.should.not.have.property("type");
//                    target0.type.should.be("table");
                    target0.should.not.have.property("columns");
//                    body0.columns.should.have.length(4);
//                    body0.columns[2].should.be("region");

                    done();
                })
        })
    })

})