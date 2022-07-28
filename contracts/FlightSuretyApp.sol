pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


// FlightSuretyData interface
contract FlightSuretyData {
    // AIRLINES
    uint256 public registeredAirlines;

    function isOperational() public view returns(bool);

    // FLIGHTS
    function registerFlight(address airlineAddress, string flight, uint256 timestamp) external;
    function setFlightStatus(bytes32 flightKey, uint8 status) external;

    
    function registerAirline(address airlineAddress) external;
    function isAirlineRegistered(address airlineAddress) external view returns(bool);
    function isAirlineFunded(address airlineAddress) external view returns(bool);

    // INSURANCES
    function buy(address passenger, bytes32 flightKey, uint price) external returns(uint insuranceId);
    function creditInsurees(address passenger) external returns(uint amountToPay);
    function pay(address passenger) external returns(uint256);
}

// FlightSuretyApp Smart Contract
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Data contract
    FlightSuretyData flightSuretyData;

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner; // Account used to deploy contract
    uint256 private multipartyThreshold = 4;
    mapping(address => address[]) private airlineVotes;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) public flights;

 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(flightSuretyData.isOperational(), "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // CONSTRUCTOR
    // The App contract constructor needs the FlightSuretyData address to initialize the data contract.
    constructor(address fsdAddress)
    public 
    {
        contractOwner = msg.sender; // Msg sender becomes the contract owner

        // Like in dependency injection, set the instance of FlightSuretyData
        flightSuretyData = FlightSuretyData(fsdAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            view
                            returns(bool) 
    {
        return flightSuretyData.isOperational();  // Modify to call data contract's status
    }

    // SMART CONTRACT FUNCTIONS

  
    // Only existing airline may register a new airline 
    // until there are at least four airlines registered
    function registerAirline(address airlineAddress)
    external
    requireIsOperational
    returns(bool success, uint256 votes)
    {
        // From test flightSurety.js: 
        // An airline cannot register another airline using registerAirline() if it is not registered and funded
        require(flightSuretyData.isAirlineRegistered(msg.sender), 'Sender is not a registered airline');
        require(flightSuretyData.isAirlineFunded(msg.sender), 'Airline is not funded');

        // Check for multi-party consensus threshold - and register accordingly
        uint256 registeredAirlines = flightSuretyData.registeredAirlines();
        ////uint256 registeredAirlines = 4;

        if (registeredAirlines < multipartyThreshold) {
            // Register the new airline by using the flightSuretyData contract
            flightSuretyData.registerAirline(airlineAddress);
        } else {
            // Make the sender part of multi-party consensus by adding its vote (and check for others)
            // Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines
            bool airlineHasVote = false;
            
            // The airlineVotes mapping will have the index of the new airline pairing with 
            // an index for each vote (or each airline address that has voted)
            // Like:   airlineVotes[address][0] -> airlineAdress
            if (airlineVotes[airlineAddress].length > 0) {
                // If airline has votes, try to find the sendred address to see if has voted before
                for (uint index = 0; index < airlineVotes[airlineAddress].length; index++) {
                    if (airlineVotes[airlineAddress][index] == msg.sender) {
                        airlineHasVote = true;
                        break;   
                    }
                }

                require(!airlineHasVote, 'Airline has voted before');
            } else {
                airlineVotes[airlineAddress] = new address[](0);
            }

            airlineVotes[airlineAddress].push(msg.sender);
            votes = airlineVotes[airlineAddress].length;

            // Multi-party consensus check
            uint256 requiredVotes = registeredAirlines.div(2); // required 50%
            
            // Check for necessary votes to register the new airline
            if(votes == requiredVotes)
            {
                flightSuretyData.registerAirline(airlineAddress);
                success = true;
                delete airlineVotes[airlineAddress];
            }
        }

        return (success, votes);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string flight, uint256 timestamp)
    requireIsOperational
    external
    {
        // An airline cannot register another airline using registerAirline() if it is not registered and funded
        require(flightSuretyData.isAirlineRegistered(msg.sender), 'Sender is not a registered airline');
        require(flightSuretyData.isAirlineFunded(msg.sender), 'Airline is not funded');

        flightSuretyData.registerFlight(msg.sender, flight, timestamp);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
        )
        internal
    {
        // Get the flight key and update its new status through the FlightSuretyData contract
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flightSuretyData.setFlightStatus(flightKey, statusCode);
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 

    // IMPLEMENT INSURANCE RELATED FUNCTIONS (buy, creditInsurees, pay)
    function buyInsurance(address airline, string flight, uint256 timestamp)
    requireIsOperational
    external
    payable
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        uint amount = msg.value;
        uint insuranceId = flightSuretyData.buy(msg.sender, flightKey, amount);
        
        // Airline receives the funds
        airline.transfer(amount);

        // Emit the appropiate event
        emit InsurancePurchased(insuranceId);
    }

    function creditInsurees()
    requireIsOperational
    external
    returns(uint256 amount)
    {
        amount = flightSuretyData.creditInsurees(msg.sender);
        // Emit the appropiate event
        emit CreditedInsurees(amount);
    }

    function payInsurance()
    requireIsOperational
    external
    returns(uint256 amount)
    {
        amount = flightSuretyData.pay(msg.sender);

        // Emit the appropiate event
        emit InsuranceSettled(amount);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    // Event fired when a passenger purchases an insurance for a fligth
    event InsurancePurchased(uint insuranceId);

    // Event fired when a passenger checks if the insurance can be claimed
    event CreditedInsurees(uint256 amount);

    // Event fired when an insurance has been settled
    event InsuranceSettled(uint256 amountPaid);

    // // Event fired when an airline is registered (for testing purposes)
    // event AirlineRegistered(address airlineAddress);

    // // Event to inform hoy many airlines have been registered (for testing purposes)
    // event InformRegisteredAirlinesCount(uint256 airlinesCount);

    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
