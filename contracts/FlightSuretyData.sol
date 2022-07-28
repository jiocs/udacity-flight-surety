pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    // CONSTANTS
    uint256 public constant FUND_AMOUNT = 10 ether;
    uint8 private constant STATUS_CODE_REGISTERED = 0;

    // From project Rubric: https://review.udacity.com/#!/rubrics/3609/view
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;

    // VARIABLES
    bool private operational = true; // Blocks all state changes throughout the contract if false
    address private contractOwner; // Account used to deploy contract
    uint256 public registeredAirlines = 0; // This will hold the number of registered airlines
    uint256 private insurancesIds = 0; // Initialize the insurances IDS

    // STRUCTS
    struct Airline {
        bool isRegistered;
        bool isFunded;
    }

    struct Flight {
        bool isRegistered;
        address airlineAddress;
        string flight;
        uint8 status;
        uint256 timestamp;
    }

    struct Insurance {
        uint insuranceId;
        bytes32 flightKey;
        uint price;
        uint256 amountToPay;
    }


    // MAPPINGS
    mapping(address => uint8) authorizedCallers;    
    mapping(address => Airline) airlines;
    mapping(bytes32 => Flight) flights;

    //// mapping(address => Insurance[]) passengerInsurances; --- This won't work because of:
    //// UnimplementedFeatureError: Copying of type struct FlightSuretyData.Insurance memory[] memory to storage not yet supported.
    //// Compilation failed. See above.
    //// Truffle v5.0.2 (core: 5.0.2)
    mapping(address => uint[]) passengerInsurances; // Instead: create a mapping of passenderAddress - insuranceId

    // Create a mapping to save the insurances referenced by its id
    mapping(uint => Insurance) insurances;

    // EVENTS

    // Constructor
    constructor(address airlineAddress) 
    public 
    {
        contractOwner = msg.sender; // The deploying account becomes contractOwner

        // Register the first line on deployment;
        airlines[airlineAddress] = Airline({
            isRegistered: true, 
            isFunded: false
        }); 

        registeredAirlines = registeredAirlines + 1;
    }

    // MODIFIERS

    // Modifier that requires the "operational" boolean variable to be "true"
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;
    }

    // Modifier that requires the "ContractOwner" account to be the function caller
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // Modifier that requires that the caller is authorized to perform an action
    modifier isCallerAuthorized() 
    {
        require(authorizedCallers[msg.sender] == 1, 'Caller is not authorized');
        _;
    }

    // UTILITY FUNCTIONS

    // Get operating status of contract
    // return A bool that is the current operating status
    function isOperational() public view returns(bool) 
    {
        return operational;
    }


    // Sets contract operations on/off
    // When operational mode is disabled, all write transactions except for this one will fail
    // Based on flightSurety.js test2: Ensure that access is denied for non-Contract Owner account (by using the requireContractOwner modifier)
    function setOperatingStatus(bool mode) 
    external
    requireContractOwner 
    {
        operational = mode;
    }

    // SMART CONTRACT FUNCTIONS

   // Add an airline to the registration queue
   // Can only be called from FlightSuretyApp contract
    function registerAirline(address airlineAddress)
    external
    isCallerAuthorized
    requireIsOperational
    {
        airlines[airlineAddress] = Airline({
            isRegistered: true, 
            isFunded: false
        });

        registeredAirlines = registeredAirlines + 1;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy(address passenger, bytes32 flightKey, uint price)
    requireIsOperational
    isCallerAuthorized
    external
    returns (uint insuranceId)
    {
        // Work with the passengerInsurances mapping to allow the user buy an insurance for the flight
        // Prevent duplicates!
        bool hasInsurance = false;
        
        if (passengerInsurances[passenger].length > 0) {
            // Check if insurance has been bought for this flight
            for (uint index = 0; index < passengerInsurances[passenger].length; index++) {
                uint id = passengerInsurances[passenger][index];
                Insurance storage insurance = insurances[id];

                if (insurance.flightKey == flightKey) {
                    hasInsurance = true;
                }
            }
        } else {
            // Initialize the passengerInsurances mapping
            passengerInsurances[passenger] = new uint[](0);
        }

        require(!hasInsurance, 'The passenger already has purchased an insurance for this flight');
        
        // Register the insurance purchased by the passenger for this flight:
        insuranceId = insurancesIds.add(1);

        insurances[insuranceId] = Insurance({
            insuranceId: insuranceId,
            flightKey: flightKey,
            price: price,
            amountToPay: 0
        });

        // Add the registered insurance to the passenger mapping
        passengerInsurances[passenger].push(insuranceId);
        
        return insuranceId;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address passenger)
    requireIsOperational
    isCallerAuthorized
    external
    returns(uint256 amountToPay)
    {
        amountToPay = 0;
        uint256 amount = 0;
        uint insuranceId = 0;

        // Fetch the Insurance data bought by the passenger and determine the amount to credit to the passenger
        for (uint index = 0; index < passengerInsurances[passenger].length; index++) {
            insuranceId = passengerInsurances[passenger][index];
            uint8 flightStatus = flights[insurances[insuranceId].flightKey].status;

            if (flightStatus == STATUS_CODE_LATE_AIRLINE) {
                // Passenger gets paid 1.5 times the price of the flight
                uint256 insuranceAmount = insurances[insuranceId].price;
                uint256 halfInsuranceAmount = insuranceAmount.div(2);

                amount = amount + insuranceAmount;
                amount = amount + halfInsuranceAmount;

                amountToPay = amount;
                insurances[insuranceId].amountToPay = amount;
            }

            // amountToPay = flightStatus;
        }

        return amountToPay;
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passengerAddress)
    external
    isCallerAuthorized
    requireIsOperational
    returns(uint256)
    {
        uint256 amountToPay = 0;
        uint256 amountPaid = 0;
        
        // Check if any of the passenger insurances has a pending amount to pay
        for (uint index = 0; index < passengerInsurances[passengerAddress].length; index++) {
            uint id = passengerInsurances[passengerAddress][index];

            if (insurances[id].amountToPay > 0) {
                amountToPay = insurances[id].amountToPay;
                
                // Reset amount to pay to zero (mark as paid)
                insurances[id].amountToPay = 0;
            }
        }

        require(amountToPay > 0, 'Amount to pay is not greater than zero');

        //If there is amount to pay, transfer the funds
        passengerAddress.transfer(amountToPay);
        amountPaid = amountToPay;

        return amountPaid;
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund()
    public
    payable
    {
        // Check for fund amount and if the airline is registered
        require(msg.value == FUND_AMOUNT);
        require(airlines[msg.sender].isRegistered);
        airlines[msg.sender].isFunded = true;
    }
    
    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }


    // IMPLEMENT MISSING FUNCTIONS

    function registerFlight(address airlineAddress, string flight, uint256 timestamp)
    requireIsOperational
    external
    {
        // Compose the flight key
        bytes32 flightKey = getFlightKey(airlineAddress, flight, timestamp);
        flights[flightKey] = Flight({
            isRegistered: true,
            flight: flight,
            status: STATUS_CODE_REGISTERED,
            timestamp: timestamp,
            airlineAddress: airlineAddress
        });
    }

    function setFlightStatus(bytes32 flightKey, uint8 status) 
    requireIsOperational
    external
    {
        flights[flightKey].status = status;
    }

    // From flightSurety.js line 10:
    function authorizeCaller(address caller) 
    requireContractOwner
    external
    {
        // Authorize the caller by adding it to the authorizedCallers mapping
        authorizedCallers[caller] = 1;
    }

    // Check if the airline is registered
    function isAirlineRegistered(address airlineAddress)
    external
    view 
    returns(bool)
    {
        return airlines[airlineAddress].isRegistered;
    }
    
    // Check if the airline is funded
    function isAirlineFunded(address airlineAddress)
    external
    view 
    returns(bool)
    {
        return airlines[airlineAddress].isFunded;
    }



    // FALLBACK FUNCTION

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}

