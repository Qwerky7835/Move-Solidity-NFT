const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTango Test Suite", function () {
    let NFTokenContract; let NFTangoManagerContract;
    let Manager; let Player; let Opponent;

    beforeEach(async function () {
        // Compile to Bytecode
        const NFTokenByteCode = await ethers.getContractFactory("NFTangoToken");
        const NFTangoManagerByteCode = await ethers.getContractFactory("NFTangoManager");

        //Deploy
        NFTokenContract = await NFTokenByteCode.deploy();
        await NFTokenContract.deployed();
        
        // No need to deploy NFTango Contract as that is deployed by the Manager
        NFTangoManagerContract = await NFTangoManagerByteCode.deploy();
        NFTangoManagerContract.deployed();

        // Get accounts: Owner - of NFTangoManager
        // Player - Creator of game
        // Opponent - opponent that joins the game
        [Owner, Player, Opponent] = await ethers.getSigners();

    });

    it("test_initialize_game_success", async function () {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        // Check Player got NFT and grab token id
        expect(await NFTokenContract.balanceOf(Player.address)).to.equal(1);
        let player_token_id = await NFTokenContract.current_tokenId();
        
        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Check NFTangoManager contract has 1 NFT
        expect(await NFTokenContract.balanceOf(NFTangoManagerContract.address)).to.equal(1);
    });
    
    it("test_initialize_game_failure_nftango_already_exists", async function(){
        // Mint 2 NFTs to the Player so they can try starting 2 games
        await NFTokenContract.safeMint(Player.address);
        let player_token_id_1 = await NFTokenContract.current_tokenId();
        await NFTokenContract.safeMint(Player.address);
        let player_token_id_2 = await NFTokenContract.current_tokenId();
        
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);

        // Initialize first game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id_1.toNumber(), 1);

        // Attempt to intialize second game and catch error
        await expect(
            NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id_2.toNumber(), 1))
            .to.be.revertedWith("ERROR_NFTANGO_STORE_EXISTS");
    });

    it("test_cancel_game_success", async function(){
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);
        
        //Cancel game
        await NFTangoManagerContract.connect(Player).cancel_game(NFTokenContract.address);

        expect(await NFTokenContract.balanceOf(Player.address)).to.equal(1);
    });

    it("test_cancel_game_failure_is_not_active", async function() {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        //Cancel game once
        await NFTangoManagerContract.connect(Player).cancel_game(NFTokenContract.address);
        // Try to cancel again but store is not active anymore
        await expect(NFTangoManagerContract.connect(Player).cancel_game(NFTokenContract.address))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_IS_NOT_ACTIVE");
    });

    it("test_cancel_game_failure_already_has_an_opponent", async function() {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Mint opponent an NFT
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        // Join Game
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address,deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);

        await expect(NFTangoManagerContract.connect(Player).cancel_game(NFTokenContract.address))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_HAS_AN_OPPONENT");
    });

    it("test_join_game_success", async function() {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Mint opponent an NFT
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        // Join Game
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address,deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);
        
        expect(await NFTokenContract.balanceOf(Opponent.address)).to.equal(0);
    });

    it("test_join_game_failure_has_an_opponent", async function() {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Creator sends a token to NFTango Contract and initialize game
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Mint opponent an NFT
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();

        // Mint another opponent an NFT
        await NFTokenContract.safeMint(Owner.address);
        let owner_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        await NFTokenContract.connect(Owner).setApprovalForAll(NFTangoManagerContract.address, true);
        // Join Game
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address,deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);

        // Another person attempts to join
        await expect(NFTangoManagerContract.join_game(Owner.address,deployed_nftango.address, [NFTokenContract.address], [owner_token_id.toNumber()]))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_HAS_AN_OPPONENT");
    });

    it("test_join_game_failure_join_amount_requirement_is_not_met", async function() {
        // Mint a NFT to the Player creating the game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        
        // Initialize game with 3 NFTs as a req
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 3);

        // Mint opponent an NFT
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();

        // Approves sending NFT to contract
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);

        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await expect(NFTangoManagerContract.join_game(Opponent.address,deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_JOIN_AMOUNT_REQUIREMENT_NOT_MET");
    });

    it("test_join_game_failure_nfts_are_different_collections", async function() {
        // Deploy a second NFToken contract/collection
        const NFTokenByteCode = await ethers.getContractFactory("NFTangoToken");
        NFTokenContract2 = await NFTokenByteCode.deploy();
        await NFTokenContract2.deployed();
        
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 2);

        // Mint 2 NFTs from different collections
        let token_ids = [];
        let collection_addresses = [];

        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        token_ids.push(opponent_token_id.toNumber());
        collection_addresses.push(NFTokenContract.address);

        await NFTokenContract2.safeMint(Opponent.address);
        let opponent_token_id_2 = await NFTokenContract2.current_tokenId();
        token_ids.push(opponent_token_id_2.toNumber());
        collection_addresses.push(NFTokenContract2.address);

        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        
        await expect(NFTangoManagerContract.join_game(Opponent.address,deployed_nftango.address, collection_addresses, token_ids))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_JOIN_AMOUNT_REQUIREMENT_NOT_MET");
    });

    it("test_play_game_success", async function() {
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Opponent Joins
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);


        // Play a game where creator wins
        let did_creator_win = true;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);
        let result = await deployed_nftango.get_result();
        expect(did_creator_win).to.equal(result);
    });

    it("test_claim_success", async function() {
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Opponent Joins
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);


        // Play a game where creator wins
        let did_creator_win = true;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);

        //Player claims
        await NFTangoManagerContract.claim(NFTokenContract.address, Player.address, Player.address);
        expect(await NFTokenContract.balanceOf(Player.address)).to.equal(2);
    });

    it("test_claim_opponent_success", async function() {
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Opponent Joins
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);


        // Play a game where opponent wins
        let did_creator_win = false;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);

        //Opponent claims
        await NFTangoManagerContract.claim(NFTokenContract.address, Opponent.address, Player.address);
        expect(await NFTokenContract.balanceOf(Opponent.address)).to.equal(2);
    });

    it("test_claim_success_multiple_join_amount_requirement", async function() {
        // Initialize game
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 2);

        // Mint opponent 2 NFTs
        let token_ids = [];
        let collection_addresses = [];

        await NFTokenContract.safeMint(Opponent.address);
        let token1 = await NFTokenContract.current_tokenId();
        token_ids.push(token1.toNumber());
        collection_addresses.push(NFTokenContract.address);
        await NFTokenContract.safeMint(Opponent.address);
        let token2 = await NFTokenContract.current_tokenId();
        token_ids.push(token2.toNumber());
        collection_addresses.push(NFTokenContract.address);

        // Approves sending NFT to contract
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);

        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, collection_addresses, token_ids);

        // Play a game where opponent wins
        let did_creator_win = false;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);

        //Opponent claims
        await NFTangoManagerContract.claim(NFTokenContract.address, Opponent.address, Player.address);
        expect(await NFTokenContract.balanceOf(Opponent.address)).to.equal(3);
    });

    it("test_claim_failure_has_claimed", async function() {  
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Opponent Joins
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);


        // Play a game where creator wins
        let did_creator_win = true;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);

        //Player claims
        await NFTangoManagerContract.claim(NFTokenContract.address, Player.address, Player.address);

        //Player tries to claim again
        await expect(NFTangoManagerContract.claim(NFTokenContract.address, Player.address, Player.address))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_HAS_CLAIMED");
    });

    it("test_claim_failure_is_not_player", async function() {
        // Player initializes game as normal
        await NFTokenContract.safeMint(Player.address);
        let player_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Player).setApprovalForAll(NFTangoManagerContract.address, true);
        NFTangoManagerContract.initialize_game(Player.address, NFTokenContract.address, player_token_id.toNumber(), 1);

        // Opponent Joins
        await NFTokenContract.safeMint(Opponent.address);
        let opponent_token_id = await NFTokenContract.current_tokenId();
        await NFTokenContract.connect(Opponent).setApprovalForAll(NFTangoManagerContract.address, true);
        
        let current_nftango = NFTangoManagerContract.Games(Player.address);
        const deployed_nftango = await hre.ethers.getContractAt("NFTango", current_nftango);
        await NFTangoManagerContract.join_game(Opponent.address, deployed_nftango.address, [NFTokenContract.address], [opponent_token_id.toNumber()]);


        // Play a game where creator wins
        let did_creator_win = true;
        await NFTangoManagerContract.play_game(Player.address, did_creator_win);

        //Owner attempts to claim
        await expect(NFTangoManagerContract.claim(NFTokenContract.address, Owner.address, Player.address))
        .to.be.revertedWith("ERROR_NFTANGO_STORE_IS_NOT_PLAYER");
    });
});