const FlightSuretyData = artifacts.require("FlightSuretyData");
const FlightSuretyApp = artifacts.require("FlightSuretyApp");
var BigNumber = require('bignumber.js');
const fs = require('fs');


module.exports = async function(deployer, network, accounts) {
    let firstAirline = accounts[1];
    let timestmp = 1658519564232;

    console.log('First Airline Address: ');
    console.log(firstAirline);

    // Deploy Data Contract
    await deployer.deploy(FlightSuretyData, firstAirline);
    var flightSuretyData = await FlightSuretyData.deployed();
    var _dataAddress = FlightSuretyData.address;

    console.log('flightSuretyData deployed, ADDRESS: ');
    console.log(_dataAddress);

     console.log('Is Operational?');
    let isop = await flightSuretyData.isOperational.call();
    console.log(isop);


    await deployer.deploy(FlightSuretyApp, _dataAddress);
    var flightSuretyApp = await FlightSuretyApp.deployed();

    var _appAddress = flightSuretyApp.address;
    
    console.log('APP deployed, ADDRESS: ');
    console.log(_appAddress);

    // Make sure to satisfy all conditions prior app deployment
    // Authorize caller
    await flightSuretyData.authorizeCaller(_appAddress);

    // Fund airline
    let fundAmount = new BigNumber(web3.utils.toWei("10", "ether"));
    flightSuretyData.fund({ from: firstAirline, value: fundAmount });

    // Passengers can choose from a fixed list of flight numbers and departures
    await flightSuretyApp.registerFlight("FIG001", timestmp, {from: firstAirline});
    await flightSuretyApp.registerFlight("FIG002", timestmp, {from: firstAirline});
    await flightSuretyApp.registerFlight("FIG003", timestmp, {from: firstAirline});
    await flightSuretyApp.registerFlight("FIG004", timestmp, {from: firstAirline});

    let config = {
        localhost: {
            url: 'http://localhost:8545',
            dataAddress: _dataAddress,
            appAddress: flightSuretyApp.address
        }
    }
    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
}