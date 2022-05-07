// =============================================================================
//                                  Config
// =============================================================================

let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

// Constant we use later
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for your contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			},
			{
				"internalType": "uint32",
				"name": "amount",
				"type": "uint32"
			}
		],
		"name": "add_IOU",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getUsers",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "debtor",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			}
		],
		"name": "lookup",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "ret",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]; // FIXME: fill this in with your contract's ABI //Be sure to only have one array, not two

// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

var contractAddress = '0x253e44c7Ec97f247eeaD10a02eC7ff20EE2d9aee'; // FIXME: fill this in with your contract's address/hash
var BlockchainSplitwise = new web3.eth.Contract(abi, contractAddress);

//map<address, map<address, amount>>
//a debtor may have multiple creditors
var debtorToCreditorsMap = {};
//a creditor may have multiple debtors
var creditorToDebtorsMap = {};
var split_strategy = [];
var split_temp = [];
var users_global = [];
// var N = users_global.length

// =============================================================================
//                            Functions To Implement
// =============================================================================

// TODO: Add any helper functions here!

// TODO: Return a list of all users (creditors or debtors) in the system
// You can return either:
//   - a list of everyone who has ever sent or received an IOU
// OR
//   - a list of everyone currently owing or being owed money
async function getUsers() {
	users_global = await BlockchainSplitwise.methods.getUsers().call();
	return users_global;
}

async function downloadAll(){
	var users = await BlockchainSplitwise.methods.getUsers().call();
	users_global = users;
	// console.log(users_global);
	var graph =  new Array(users.length);
	for(var i = 0;i < graph.length; i++){
   		graph[i] = new Array(users.length);
	}
	for(var r = 0; r < users.length; r++){
		for(var c = 0; c < users.length; c++){
			if(r == c){
				graph[r][c] = 0;
				continue;
			}
			var debtor = users[r];
			var creditor = users[c];
			var amount = await BlockchainSplitwise.methods.lookup(debtor, creditor).call();
			graph[r][c] = amount;
			if(amount == 0) continue;
			if(debtorToCreditorsMap[debtor] == null){
				var map = {};
				map[creditor] = amount;
				debtorToCreditorsMap[debtor] = map;
			}else{
				debtorToCreditorsMap[debtor][creditor] = amount;
			}
			if(creditorToDebtorsMap[creditor] == null){
				var map = {};
				map[debtor] = amount;
				creditorToDebtorsMap[creditor] = map;
			}else{
				creditorToDebtorsMap[creditor][debtor] = amount;
			}
		}
	}
	// console.log(graph)
	minCashFlow(graph)
}

function getMin(arr)
    {
	var minInd = 0;
	for (i = 1; i < users_global.length; i++)
		if (arr[i] < arr[minInd])
			minInd = i;
	return minInd;
    }

    // A utility function that returns
    // index of maximum value in arr
function getMax(arr)
    {
	var maxInd = 0;
	for (i = 1; i < users_global.length; i++)
		if (arr[i] > arr[maxInd])
			maxInd = i;
	return maxInd;
    }

    // A utility function to return minimum of 2 values
function minOf2(x , y)
    {
	return (x < y) ? x: y;
    }

    // amount[p] indicates the net amount
    // to be credited/debited to/from person 'p'
    // If amount[p] is positive, then
    // i'th person will amount[i]
    // If amount[p] is negative, then
    // i'th person will give -amount[i]
function minCashFlowRec(amount)
    {

	// Find the indexes of minimum and
	// maximum values in amount
	// amount[mxCredit] indicates the maximum amount
	// to be given (or credited) to any person .
	// And amount[mxDebit] indicates the maximum amount
	// to be taken(or debited) from any person.
	// So if there is a positive value in amount,
	// then there must be a negative value
	var mxCredit = getMax(amount), mxDebit = getMin(amount);

	// If both amounts are 0, then
	// all amounts are settled
	if (amount[mxCredit] == 0 && amount[mxDebit] == 0)
		return;

	// Find the minimum of two amounts
	var min = minOf2(-amount[mxDebit], amount[mxCredit]);
	amount[mxCredit] -= min;
	amount[mxDebit] += min;

	// If minimum is the maximum amount to be
	split_temp.push("User " + users_global[mxDebit] + " should pay " + min
							+ " to " + "User " + users_global[mxCredit]);
	// console.log("User " + users_global[mxDebit] + " should pay " + min
	// 						+ " to " + "User " + users_global[mxCredit]);

	// Recur for the amount array.
	// Note that it is guaranteed that
	// the recursion would terminate
	// as either amount[mxCredit]  or
	// amount[mxDebit] becomes 0
	minCashFlowRec(amount);
    }

    // Given a set of persons as graph
    // where graph[i][j] indicates
    // the amount that person i needs to
    // pay person j, this function
    // finds and prints the minimum
    // cash flow to settle all debts.
function minCashFlow(graph)
    {
	// Create an array amount,
	// initialize all value in it as 0.
	var amount=Array.from({length: users_global.length}, (_, i) => 0);
	split_temp = [];

	// Calculate the net amount to
	// be paid to person 'p', and
	// stores it in amount[p]. The
	// value of amount[p] can be
	// calculated by subtracting
	// debts of 'p' from credits of 'p'
	for (p = 0; p < users_global.length; p++)
	for (i = 0; i < users_global.length; i++)
		amount[p] += (graph[i][p] - graph[p][i]);
	// console.log(users_global.length);
	// console.log(amount);
	if(users_global.length!=0) {
		minCashFlowRec(amount, split_temp);
		split_strategy = split_temp;
		console.log(split_strategy);
	}
    }



// TODO: Get the total amount owed by the user specified by 'user'
async function getTotalOwed(user) {
	if(users_global == null || users_global.length == 0){
		await downloadAll();
	}

	var debtorMap = debtorToCreditorsMap[user];
	var creditorMap = creditorToDebtorsMap[user];
	var amount = 0.0;
	for(var key in debtorMap){
		amount += parseFloat(debtorMap[key]);
	}
	for(var key in creditorMap){
		amount -= parseFloat(creditorMap[key]);
		if(amount <= 0) {
			return 0;
		}
	}
	return amount;
}

// TODO: Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
// Return null if you can't find any activity for the user.
// HINT: Try looking at the way 'getAllFunctionCalls' is written. You can modify it if you'd like.
async function getLastActive(user) {
	user = user.toLowerCase();
	var function_calls = await getAllFunctionCalls(contractAddress, "add_IOU");
	//function_calls.concat(await getAllFunctionCalls(contractAddress, "lookup"));
	var last_call = null;
	for(var i = 0; i < function_calls.length; i++){
		var call = function_calls[i];
		
		if(call["from"] == user){
			last_call = call;
		}
	}
	if(last_call){
		return last_call["t"];
	}
	return null;
}

//web3.eth.personal.unlockAccount("0x7E4BeBdC4BacdbbC464d1b0830C81F4fa9B59698", 36000000)
// TODO: add an IOU ('I owe you') to the system
// The person you owe money is passed as 'creditor'
// The amount you owe them is passed as 'amount'
async function add_IOU(creditor, amount) {
	BlockchainSplitwise.methods.add_IOU(creditor, parseInt(amount)).send({'from': web3.eth.defaultAccount, gas: 3141592});
	await downloadAll();
}

// =============================================================================
//                              Provided Functions
// =============================================================================
// Reading and understanding these should help you implement the above

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from'), arguments ('args'), and the timestamp ('t')
async function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = await web3.eth.getBlockNumber();
	var function_calls = [];

	while (curBlock !== GENESIS) {
	  var b = await web3.eth.getBlock(curBlock, true);
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];

	  	// check that destination of txn is our contract
		if(txn.to == null){continue;}
	  	if (txn.to.toLowerCase() === addressOfContract.toLowerCase()) {
	  		var func_call = abiDecoder.decodeMethod(txn.input);

			// check that the function getting called in this txn is 'functionName'
			if (func_call && func_call.name === functionName) {
				var time = await web3.eth.getBlock(curBlock);
				var args = func_call.params.map(function (x) {return x.value});
				function_calls.push({
					from: txn.from.toLowerCase(),
					args: args,
						t: time.timestamp
				})
	  		}
	  	}
	  }
	  curBlock = b.parentHash;
	}
	return function_calls;
}

// We've provided a breadth-first search implementation for you, if that's useful
// It will find a path from start to end (or return null if none exists)
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its neighbors (as an array)
async function doBFS(start, end, getNeighbors) {
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift();
		var lastNode = cur[cur.length-1]
		if (lastNode === end) {
			return cur;
		} else {
			var neighbors = await getNeighbors(lastNode);
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

// =============================================================================
//                                      UI
// =============================================================================


// This sets the default account on load and displays the total owed to that
// account.
web3.eth.getAccounts().then((response)=> {
	web3.eth.defaultAccount = response[0];

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);

		// Get Creditors and Amount
		var creditor_amount = ""
		var temp = debtorToCreditorsMap[web3.eth.defaultAccount]
		// console.log(web3.eth.defaultAccount)
		// console.log(temp)
		for (var key in temp) {
			creditor_amount += "<p>" + key + ": " + '<b>' + temp[key] + '</b>' + "</p>"
		}
		// for (var i = 0; i < length(temp); i++) {
		// 	creditor_amount += "<p>" + temp[0]
		// }
		$("#creditors").html(creditor_amount);
	});

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// This code updates the 'My Account' UI with the results of your functions
$("#myaccount").change(function() {
	web3.eth.defaultAccount = $(this).val();

	var creditor_amount = ""
	var temp = debtorToCreditorsMap[web3.eth.defaultAccount]
	// console.log(web3.eth.defaultAccount)
	// console.log(temp)
	for (var key in temp) {
		creditor_amount += "<p>" + key + ": " + '<b>' + temp[key] + '</b>' + "</p>"
	}
	// for (var i = 0; i < length(temp); i++) {
	// 	creditor_amount += "<p>" + temp[0]
	// }
	$("#creditors").html(creditor_amount);

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	})

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
web3.eth.getAccounts().then((response)=>{
	var opts = response.map(function (a) { return '<option value="'+
			a.toLowerCase()+'">'+a.toLowerCase()+'</option>' });
	$(".account").html(opts);
	$(".wallet_addresses").html(response.map(function (a) { return '<li>'+a.toLowerCase()+'</li>' }));
});

// This code updates the 'Users' list in the UI with the results of your function
getUsers().then((response)=>{
	$("#all_users").html(response.map(function (u,i) { return "<li>"+u+"</li>" }));
});

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
	web3.eth.defaultAccount = $("#myaccount").val(); //sets the default account
	add_IOU($("#creditor").val(), $("#amount").val()).then((response)=>{
			window.location.reload(true); // refreshes the page after add_IOU returns and the promise is unwrapped
		})
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


// =============================================================================
//                                      TESTING
// =============================================================================

// This section contains a sanity check test that you can use to ensure your code
// works. We will be testing your code this way, so make sure you at least pass
// the given test. You are encouraged to write more tests!

// Remember: the tests will assume that each of the four client functions are
// async functions and thus will return a promise. Make sure you understand what this means.

function check(name, condition) {
	if (condition) {
		console.log(name + ": SUCCESS");
		return 3;
	} else {
		console.log(name + ": FAILED");
		return 0;
	}
}

async function sanityCheck() {
	console.log ("\nTEST", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	var score = 0;

	var accounts = await web3.eth.getAccounts();
	web3.eth.defaultAccount = accounts[0];

	var users = await getUsers();
	score += check("getUsers() initially empty", users.length === 0);

	var owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) initially empty", owed === 0);

	var lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	var response = await add_IOU(accounts[1], "10");

	users = await getUsers();
	score += check("getUsers() now length 2", users.length === 2);

	owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) now 10", owed === 10);

	lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	var timeLastActive = await getLastActive(accounts[0]);
	var timeNow = Date.now()/1000;
	var difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 seconds

	console.log("Final Score: " + score +"/21");
}

//sanityCheck() //Uncomment this line to run the sanity check when you first open index.html


// 获取弹窗
var modal = document.getElementById('myModal');
 
// 打开弹窗的按钮对象
var btn = document.getElementById("myBtn");
 
// 获取 <span> 元素，用于关闭弹窗
var span = document.querySelector('.close');
 
// 点击按钮打开弹窗
btn.onclick = function() {
    modal.style.display = "block";
}
 
// 点击 <span> (x), 关闭弹窗
span.onclick = function() {
    modal.style.display = "none";
}
 
// 在用户点击其他地方时，关闭弹窗
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}