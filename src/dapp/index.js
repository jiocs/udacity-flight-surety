
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;
    
    const STATUS_CODE_UNKNOWN = "0";
    const STATUS_CODE_ON_TIME = "10";
    const STATUS_CODE_LATE_AIRLINE = "20";
    const STATUS_CODE_LATE_WEATHER = "30";
    const STATUS_CODE_LATE_TECHNICAL = "40";
    const STATUS_CODE_LATE_OTHER = "50";

    let contract = new Contract('localhost', () => {

        console.log('Contract:');
        console.log(contract);

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    
                

        // We can find an example of how to register the event listener in 
        // server.js::13
        // flightSuretyApp.events.OracleRequest({
        //     fromBlock: 0
        //   }, function (error, event) {
        //     if (error) console.log(error)
        //     console.log(event)
        // });

        // Register to the event declared at FlightSuretyApp.sol::FlightStatusInfo
        // which is fired each time an oracle submits a response
        contract.flightSuretyApp.events.FlightStatusInfo({
            fromBlock: 0
        }, function (error, event) {
            // Returned info
            console.log('FlightStatusInfo event result: ');
            console.log(event);

            console.log('ERROR: ');
            console.log(error);

            let flightStatus = '';
            switch(event.returnValues.status)
            {
                case STATUS_CODE_UNKNOWN:
                    flightStatus = "UNKNOWN";
                    break;
                case STATUS_CODE_ON_TIME:
                    flightStatus = "ON TIME";
                    break;
                case STATUS_CODE_LATE_AIRLINE:
                    flightStatus = "LATE AIRLINE";
                    break;
                case STATUS_CODE_LATE_WEATHER:
                    flightStatus = "LATE WEATHER";
                    break;
                case STATUS_CODE_LATE_TECHNICAL:
                    flightStatus = "LATE TECHNICAL";
                    break;
                case STATUS_CODE_LATE_OTHER:
                    flightStatus = "LATE OTHER";
                    break;
            }
            displayFlightStatusInfo('Flight Status Info', 'Status info returned by oracles', [{label: 'Flight status', error: error, value: event.returnValues.flight + ' ' + flightStatus}]);

        });

        // Watch the event of purchasing an insurance
        contract.flightSuretyApp.events.InsurancePurchased({
            fromBlock: 0
        }, function (error, event) {
            console.log('Buy Insurance Event result;');
            console.log(event);

            console.log('Buy Insurance Event error;');
            console.log(error);

            displayFlightStatusInfo('Buy Insurance Info', 'Buy Insurance info returned by oracles', [{label: 'Buy Insurance Result ID:', error: error, value: event.returnValues.insuranceId}]);
        });

        
        // Watch the event of creditInsurees
        contract.flightSuretyApp.events.CreditedInsurees({
            fromBlock: 0
        }, function (error, event) {
            console.log('Credit Insuree Event result;');
            console.log(event);

            console.log('Credit Insuree Event error;');
            console.log(error);

            displayFlightStatusInfo('Credit Insuree Info', 'Credit Insuree info returned by oracles', [{label: 'Insurance Amount to Pay: ', error: error, value: event.returnValues.amount + ' wei'}]);
        });
        

        // Watch the event of insurance paid
        contract.flightSuretyApp.events.InsuranceSettled({
            fromBlock: 0
        }, function (error, event) {
            console.log('Insurance Paid Event result;');
            console.log(event);

            console.log('Insurance Paid Event error;');
            console.log(error);

            displayFlightStatusInfo('Insurance Paid Info', 'Insurance Paid info returned by oracles', [{label: 'Insurance Paid with amount: ', error: error, value: event.returnValues.amountPaid + ' wei'}]);
        });


        // // // Watch the event of informing the number of registered airlines
        // // contract.flightSuretyApp.events.InformRegisteredAirlinesCount({
        // //     fromBlock: 0
        // // }, function (error, event) {
        // //     console.log('Airlines Count Event result;');
        // //     console.log(event);

        // //     console.log('Airlines Count Event error;');
        // //     console.log(error);

        // //     displayFlightStatusInfo(
        // //         'Airlines Count Info', 
        // //         'Airlines Count Info returned by oracles', 
        // //         [{
        // //             label: 'Registered airlines: ', 
        // //             error: error, value: event.returnValues
        // //         }]
        // //     );
        // // });
                

                
        


        displayRegisteredAirlines(contract.airlines);
        displayRegisteredFlights(contract.airlines);

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            let airline = DOM.elid('airline-address').value;
            // Write transaction
            contract.fetchFlightStatus(airline, flight, (error, result) => {
                console.log('fetchFlightStatus request');
                console.log(result);
                console.log(error);
                ////display('Oracles', 'Trigger oracles', [ { label: 'Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })     

        // User-submitted transaction
        DOM.elid('buy-insurance').addEventListener('click', () => {
            let flight = DOM.elid('passenger-flight-number').value;
            let airline = DOM.elid('passenger-airline-address').value;
            let amount = DOM.elid('insurance-amount').value;
            // Write transaction
            // buyInsurance(airline, flight, price, callback) {

            contract.buyInsurance(airline, flight, amount, (error, result) => {
                console.log('Buy Insurance Result: ');
                console.log(error);
                console.log(result);
                displayFlightStatusInfo('Buy Insurance', 'Buy Insurance info returned by oracles', [{label: 'Buy Insurance Result', error: error, value: result}]);
            });
        })

         // User-submitted transaction
         DOM.elid('credit-insuree').addEventListener('click', () => {
            // Write transaction
            // creditInsurees(callback) {

            contract.creditInsurees((error, result) => {
                console.log('Credit Insuree Result: ');
                console.log(error);
                console.log(result);
                displayFlightStatusInfo('Credit Insuree', 'Credit Insuree info returned by oracles', [{label: 'Credit Insuree Result Tx:', error: error, value: result}]);
            });
        })

        
         // User-submitted transaction
         DOM.elid('pay-insurance').addEventListener('click', () => {
            // Write transaction
            // payInsurance(callback) {

            contract.payInsurance((error, result) => {
                console.log('Pay Insurance Result: ');
                console.log(error);
                console.log(result);
                displayFlightStatusInfo('Pay Insurance', 'Pay Insurance info returned by oracles', [{label: 'Pay Insurance Result Tx:', error: error, value: result}]);
            });
        })

    });
    

})();

function displayRegisteredAirlines(airlines) {
    let container = DOM.elid("airlines-container");

    // Registered flights during migration:
    // // await flightSuretyApp.registerFlight("FIG001", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG002", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG003", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG004", timestmp, {from: firstAirline});
    container.appendChild(DOM.h4("Airline accounts: "));
    for (let index = 0; index < airlines.length; index++) {
        container.appendChild(DOM.div(airlines[index]));
    }
}


function displayRegisteredFlights(airlines) {
    let container = DOM.elid("flights-container");

    // Registered flights during migration:
    // // await flightSuretyApp.registerFlight("FIG001", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG002", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG003", timestmp, {from: firstAirline});
    // // await flightSuretyApp.registerFlight("FIG004", timestmp, {from: firstAirline});
    container.appendChild(DOM.h4("Flights"));
    container.appendChild(DOM.div("FIG001"));
    container.appendChild(DOM.div("FIG002"));
    container.appendChild(DOM.div("FIG003"));
    container.appendChild(DOM.div("FIG004"));
    container.appendChild(DOM.div("All flights registered were registered during migrations under airline: " + airlines[0]));
}

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    // section.appendChild(DOM.h2(title));
    // section.appendChild(DOM.h5(description));

    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}

function displayFlightStatusInfo(title, description, results) {
    let displayDiv = DOM.elid("statusinfo-wrapper");
    let section = DOM.section();
    // section.appendChild(DOM.h2(title));
    // section.appendChild(DOM.h5(description));

    displayDiv.append("");
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







