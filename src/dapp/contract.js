import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        /**
         * Change the provider in order to avoid errors like:
         * Error: The current provider doesn't support subscriptions: HttpProvider
                at Subscription.subscribe (subscription.js:206:20)
                at Contract._on (index.js:640:18)
                at eval (index.js:46:45)
                at Object.eval [as callback] (contract.js:51:9)
         */
        //this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            // Display airlines addresses

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(airline, flight, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flight,
            timestamp: 1658519564232
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    // Setup the calls for Insurance-related functions

    // For function buyInsurance(address airline, string flight, uint256 timestamp)
    buyInsurance(airline, flight, price, callback) {
        console.log('On CONTRACT buy insurance');
        let self = this;
        // // let payload = {
        // //     airline: airline,
        // //     flight: flight,
        // //     timestamp: Math.floor(Date.now() / 1000)
        // // }

        
        // // flightSuretyApp.methods
        // //   .submitOracleResponse(event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp, randomStatus)
        // //   .send({from:address, gas:"8500000"})
        // //   .then(result => {
        // //     console.log('Status Registered...');
        // //     console.log(result);
        // //   });


        let timestamp = 1658519564232;
        let amount = Web3.utils.toWei(price, "ether");
        self.flightSuretyApp.methods
            .buyInsurance(airline, flight, timestamp)
            .send({from: self.passengers[0], value:amount, gas:"8500000"}, (error, result) => {
                callback(error, result);
            });
    }

    // For function creditInsurees()
    creditInsurees(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .creditInsurees()
            .send({from:self.passengers[0], gas:"8500000"}, (error, result) => {                
                console.log('On Contract Credit Insurees...');
                console.log(result);
                console.log(error);
                callback(error, result);
            });
    }

    // For function payInsurance()
    payInsurance(callback) {
        let self = this;
        self.flightSuretyApp.methods
        .payInsurance()
        .send({from:self.passengers[0], gas:"8500000"}, (error, result) => {
            callback(error, result);
        });
    }
}