
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  console.log('On flightSurety tests');

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    // console.log('(Before) Config accounts: ');
    // console.log(accounts);

    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  // Test 1
  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  // Test 2
  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  // Test 3
  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  // Test 4
  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  // Test 5
  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });


  // Multi-party consensus tests

  // Test 6
  it('(multiparty) Only existing airline can register another airline until there are at least four airlines registered', async () => {
    // ARRANGE
    let airline_two = accounts[2];
    let airline_three = accounts[3];
    let airline_four = accounts[4];
    let airline_five = accounts[5];

    let fundAmount = new BigNumber(web3.utils.toWei("10", "ether"));

    // ACT
    // Register airline_two from firstAirline
    try {
        await config.flightSuretyData.fund({from:config.firstAirline, value:fundAmount});
        var regResult = await config.flightSuretyApp.registerAirline(airline_two, {from:config.firstAirline});    
        // console.log('Registration result:');
        // console.log(regResult);

    } catch (error) {
      console.log('Register Airline 2 exception: ');
      console.log(error);
    }
    
    let airline_two_registered = await config.flightSuretyData.isAirlineRegistered.call(airline_two);

    try {
        await config.flightSuretyData.fund({from:airline_two, value:fundAmount});
        await config.flightSuretyApp.registerAirline(airline_three, {from:airline_two});
    } catch (error) {
      console.log('Register Airline 3 exception: ');
        console.log(error);
    }
    
    let airline_three_registered = await config.flightSuretyData.isAirlineRegistered.call(airline_three);

    try {
        await config.flightSuretyData.fund({from:airline_three, value:fundAmount});
        await config.flightSuretyApp.registerAirline(airline_four, {from:airline_three});    
    } catch (error) {
      console.log('Register Airline 4 exception: ');
        console.log(error);
    }
    
    let airline_four_registered = await config.flightSuretyData.isAirlineRegistered.call(airline_four);

    // Fund fourth airline and try to register the fifth airline
    try {
        await config.flightSuretyData.fund({from:airline_four, value:fundAmount});
        await config.flightSuretyApp.registerAirline(airline_five, {from:airline_four});
    } catch (error) {
      console.log('Register Airline 5 exception: ');
        console.log(error);
    }
    
    let airline_five_registered = await config.flightSuretyData.isAirlineRegistered.call(airline_five);

    // ASSERT
    assert.equal(airline_two_registered, true, 'Airline 2 NOT registered');
    assert.equal(airline_three_registered, true, 'Airline 3 NOT registered');
    assert.equal(airline_four_registered, true, 'Airline 4 NOT registered');
    assert.equal(airline_five_registered, false, 'Airline 4 CANNOT register Airline 5');
  });

  // Test 6
  it('(multiparty) Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async () => {
    // ARRANGE
    let airline_two = accounts[2];
    let airline_three = accounts[3];
    let airline_four = accounts[4];
    let airline_five = accounts[5];
    let airline_six = accounts[6];

    let fundAmount = new BigNumber(web3.utils.toWei("10", "ether"));

    // ACT
    // Register airline_five with 2 votes
    try {
        await config.flightSuretyApp.registerAirline(airline_five, {from:airline_four});  
    } catch (error) {
      // console.log('Register Airline 5 exception: (Vote 1)');
      // console.log(error);
    }
    
    let airline_five_registered_at_firstvote = await config.flightSuretyData.isAirlineRegistered.call(airline_five);

    try {
        await config.flightSuretyApp.registerAirline(airline_five, {from:airline_three});  
    } catch (error) {
      // console.log('Register Airline 5 exception: Vote 2');
      // console.log(error);
    }
    
    let airline_five_registered_at_secondvote = await config.flightSuretyData.isAirlineRegistered.call(airline_five);

    // Register airline_six with 3 votes
    try {
      // Airline 2 - first vote
        await config.flightSuretyApp.registerAirline(airline_six, {from:airline_two});
    } catch (error) {
      // console.log('Register Airline 6 exception: (Vote 1)');
      // console.log(error);
    }
    
    let airline_six_registered_atfirstvote = await config.flightSuretyData.isAirlineRegistered.call(airline_six);

    try {
      // Airline 3 - second vote
        await config.flightSuretyApp.registerAirline(airline_six, {from:airline_three});
    } catch (error) {
      // console.log('Register Airline 6 exception: (Vote 2)');
      // console.log(error);
    }
    
    let airline_six_registered_atsecondtvote = airline_five_registered_at_firstvote && await config.flightSuretyData.isAirlineRegistered.call(airline_six);

    try {
        await config.flightSuretyApp.registerAirline(airline_six, {from:airline_four});
    } catch (error) {
      // console.log('Register Airline 6 exception: (Vote)');
      // console.log(error);
    }
    
    let airline_six_registered_atthirdtvote = await config.flightSuretyData.isAirlineRegistered.call(airline_six);

    // ASSERT
    assert.equal(airline_five_registered_at_firstvote, false, 'Airline 5 WAS erroneously registered at first vote.');
    assert.equal(airline_five_registered_at_secondvote, true, 'Airline 5 NOT registered, even after second vote');
    assert.equal(airline_six_registered_atfirstvote, false, 'Airline 6 WAS erroneously registered at first vote.');
    assert.equal(airline_six_registered_atsecondtvote, false, 'Airline 6 WAS erroneously registered at second vote.');
    assert.equal(airline_six_registered_atthirdtvote, true, 'Airline NOT registered, even after third vote.');
  });

    
  
  // INSURANCES TEST
  // Test 8

  it('(passenger) can buy insurance for a flight', async () => {
    // ARRANGE
    let airline = accounts[1];
    let passenger = accounts[7];
    let flight = "FIG001";
    let timestamp = 1658519564232;
    let price = new BigNumber(web3.utils.toWei("1", "ether"));
    var eventEmitted = false;

    // ACT
    try {
        await config.flightSuretyApp
            .buyInsurance(airline, flight, timestamp, {from: passenger, value: price});
        
        eventEmitted = true;
    }
    catch(e) {
        console.log('Error on buyInsurance call');
        console.log(e);
    }
    
    // ASSERT
    assert.equal(eventEmitted, true, 'Insurance NOT PURCHASED');
  });
  
  // // // Test 9
  // // it('(passenger) can check if the insurance has a pending amount to pay', async () => {
  // //   // ARRANGE
  // //   let passenger = accounts[7];
  // //   let pendingAmount = 0;

  // //   // ACT
  // //   try {
  // //       pendingAmount = await config.flightSuretyApp.creditInsurees.call({from:passenger});
  // //       console.log('Insurance has payment: ');
  // //       console.log(pendingAmount);
  // //   } catch (error) {
  // //       console.log('Error on credit Insurees call');
  // //       console.log(error);
  // //   }

  // //   // ASSERT
  // //   let notZero = pendingAmount != 0;
  // //   assert.equal(notZero, true, 'is zero');
  // // });

      
  // // // Test 10
  // // it('(passenger) can receive flight insurance payment', async () => {
  // //   // ARRANGE
  // //   let passenger = accounts[7];
  // //   let amountPaid = 0;

  // //   // ACT
  // //   try {
  // //       amountPaid = await config.flightSuretyApp.payInsurance.call({from: passenger});
  // //       console.log('Amount was paid:');
  // //       console.log(amountPaid);
  // //   }
  // //   catch(e) {
  // //       console.log('Payment error: ');
  // //       console.log(e);
  // //   }

  // //   // ASSERT
  // //   let notZero = amountPaid != 0;
  // //   assert.equal(notZero, true, "Payment is zero");

  // // });

});
