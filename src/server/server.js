import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let registrationAmount = web3.utils.toWei("1", "ether");
var oracles = new Map();

// From Project Rubric

// 1.- Oracle functionality is implemented in the server app.


// 2.- Upon startup, 20+ oracles are registered and their assigned indexes are persisted in memory
// To do so, get 20 accounts different from the airlines accounts, and from passenger accounts
web3.eth.getAccounts().then(accounts => {
  for (let index = 29; index > 9; index--) {
    let oracle = accounts[index];
          
    // Register the oracle and persist the indexes
    flightSuretyApp.methods
      .registerOracle()
      .send({from:oracle, value:registrationAmount, gas:"8500000"})
      .then(result => {
        flightSuretyApp.methods
          .getMyIndexes()
          .call({from:oracle})
          .then(indexes => {
            oracles.set(oracle, indexes);
            //console.log(oracles);
          });
      });
  }
});


flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    console.log('On OracleRequest event listener...');
    console.log('Oracles:');
    console.log(oracles);

    // Server will loop through all registered oracles, identify those oracles for which 
    // the OracleRequest event applies, and respond by calling into FlightSuretyApp contract 
    // with random status code of Unknown (0), On Time (10) or Late Airline (20), 
    // Late Weather (30), Late Technical (40), or Late Other (50)
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;
    
    let eventIndex = event.index;
    let airline = event.airline;
    let flight = event.flight;
    let timestamp = event.timestamp;

    // Loop through all registered oracles
    oracles.forEach((indexes, address) => {
      // the OracleRequest event applies?
      if (indexes.includes(event.returnValues.index)) {
        // Oracle found
        console.log('Oracle Found');
        console.log(address);
        console.log(indexes);

        // Respond by calling into FlightSuretyApp contract with random status code
        var statuses = [
          STATUS_CODE_UNKNOWN, 
          STATUS_CODE_ON_TIME, 
          STATUS_CODE_LATE_AIRLINE,
          STATUS_CODE_LATE_WEATHER,
          STATUS_CODE_LATE_TECHNICAL,
          STATUS_CODE_LATE_OTHER
        ];

        let randomIndex = Math.floor(Math.random() * statuses.length);
        let randomStatus = statuses[randomIndex];
        console.log('random status: ' + randomStatus);

        // // // TEMP:   
        // // randomStatus = STATUS_CODE_LATE_AIRLINE;
        
        flightSuretyApp.methods
          .submitOracleResponse(event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp, randomStatus)
          .send({from:address, gas:"8500000"})
          .then(result => {
            console.log('Status Registered...');
            console.log(result);
          });
      }
    });

    

    if (error) console.log(error)
  
    
    // EVENT INFO: 
    console.log(event)

    // // {                                                                                                                                                         
    // //   logIndex: 0,                                                                                                                                            
    // //   transactionIndex: 0,                                                                                                                                    
    // //   transactionHash: '0x2621c4d68588c81497dd2261257ba841fe435724f3bd11654ae5742915a0c798',                                                                  
    // //   blockHash: '0x4937da3d74f91f06046837a0ad205c4999dc8e7b31db40ac9cecae20bd2c931d',                                                                        
    // //   blockNumber: 237,                                                                                                                                       
    // //   address: '0xdDA6327139485221633A1FcD65f4aC932E60A2e1',                                                                                                  
    // //   type: 'mined',                                                                                                                                          
    // //   id: 'log_15e596d1',                                                                                                                                     
    // //   returnValues: Result {                                                                                                                                  
    // //     '0': '3',                                                                                                                                             
    // //     '1': '0xf17f52151EbEF6C7334FAD080c5704D77216b732',                                                                                                    
    // //     '2': 'FIG001',                                                                                                                                        
    // //     '3': '1658365690',                                                                                                                                    
    // //     index: '3',                                                                                                                                           
    // //     airline: '0xf17f52151EbEF6C7334FAD080c5704D77216b732',                                                                                                
    // //     flight: 'FIG001',                                                                                                                                     
    // //     timestamp: '1658365690'                                                                                                                               
    // //   },                                                                                                                                                      
    // //   event: 'OracleRequest',                                                                                                                                 
    // //   signature: '0x3ed01f2c3fc24c6b329d931e35b03e390d23497d22b3f90e15b600343e93df11',                                                                        
    // //   raw: {                                                                                                                                                  
    // //     data: '0x00000006464947303031',                                                                                                                   
    // //     topics: [                                                                                                                                             
    // //       '0x3ed01f2c3fc24c6b329d931e35b03e390d23497d22b3f90e15b600343e93df11'                                                                                
    // //     ]                                                                                                                                                     
    // //   }                                                                                                                                                       
    // // }                                                                                                                                                         

});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


