//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./NFToken.sol";
import "./NFTango.sol";

contract NFTangoManager {

    // Errors
    string private constant CODE_0 = "ERROR_NFTANGO_STORE_EXISTS";
    string private constant CODE_1 = "ERROR_NFTANGO_STORE_DOES_NOT_EXIST";
    string private constant CODE_10 = "ERROR_VECTOR_LENGTHS_NOT_EQUAL";

    // Assert Functions
    function assert_nftango_store_exists(address creator) public view returns(address){
        require(address(Games[creator]) != address(0), CODE_1);
        return address(Games[creator]);
    }

    function assert_nftango_store_does_not_exist(address creator) private view{
        require(address(Games[creator]) == address(0), CODE_0);
    }

    function assert_vector_lengths_are_equal(uint[] calldata tokenid, address[] calldata collection_address) private pure{
        require(tokenid.length==collection_address.length, CODE_10);
    }

    // Struct
    mapping(address => NFTango) public Games;
    
    // To Join a game: 
    // 1. If this is the first game active game, the Manager creates a new Contract to govern the game
    // 2. The creator of the game must put in one NFT
    // 3. The creator specifies how many NFTs to opponent must put in
    function initialize_game(address creator, address collection_addr, uint creator_tokenid, uint join_amount_requirement) public {
        // Assert store does not exist
        assert_nftango_store_does_not_exist(creator);

        // Call NFT contract to get the NFT from the creator
        NFTangoToken NFTcontract = NFTangoToken(collection_addr);
        NFTcontract.transferFrom(creator, address(this), creator_tokenid);

        // Spawn a NFTango contract
        NFTango NFTangoGame = new NFTango();
        
        // Initialize Game State
        NFTangoGame.set_initialized_state(creator_tokenid, join_amount_requirement);

        // Track the game creator address and contract
        Games[creator] = NFTangoGame;
    }

    function cancel_game(address collection_addr) public {
        // Cancel active games before an eligible opponent joins
        assert_nftango_store_exists(msg.sender);
        NFTango annul_game = Games[msg.sender];

        annul_game.assert_nftango_store_is_active();
        annul_game.assert_nftango_store_does_not_have_an_opponent();

        // Get TokenId and transfer NFT back to creator
        uint creator_token = annul_game.get_creator_token();
        NFTangoToken NFTcontract = NFTangoToken(collection_addr);
        NFTcontract.transferFrom(address(this), msg.sender, creator_token);

        annul_game.set_cancel_state();
    }

    function join_game(address opponent, address game, address[] calldata collection_addr, uint[] calldata token_ids) public {
        // Check collection and token id arrays are the same length
        assert_vector_lengths_are_equal(token_ids, collection_addr);
        
        // Get contract from address
        NFTango new_game = NFTango(game);

        // check correct initial state
        new_game.assert_nftango_store_is_active();
        new_game.assert_nftango_store_does_not_have_an_opponent();
        new_game.assert_nftango_store_join_amount_requirement_is_met(token_ids, collection_addr);

        // Send NFTs to contract
        NFTangoToken NFTcontract = NFTangoToken(collection_addr[0]);
        uint token_len = token_ids.length;
        for(uint i = 0; i < token_len; i++){
            NFTcontract.transferFrom(opponent, address(this), token_ids[i]);
        }

        // Check ready to play state
        new_game.set_join_state(opponent, token_ids);
    }

    function play_game(address creator, bool did_creator_win) public {
        assert_nftango_store_exists(creator);
        NFTango start_game = NFTango(address(Games[creator]));

        // Assert game begins with opponent
        start_game.assert_nftango_store_is_active();
        start_game.assert_nftango_store_has_an_opponent();

        // Set outcome
        start_game.set_game_state(did_creator_win);
    }

    function claim(address collection_addr, address claimer, address creator) public {
        assert_nftango_store_exists(creator);
        NFTango end_game = NFTango(address(Games[creator]));

        //Check state
        end_game.assert_nftango_store_is_not_active();
        end_game.assert_nftango_store_has_not_claimed();
        end_game.assert_claimer_is_player(claimer, creator);

        // Winner takes all
        NFTangoToken NFToken = NFTangoToken(collection_addr);

        uint creator_token; uint[] memory opponent_tokens; address opponent_addr;
        (creator_token, opponent_tokens, opponent_addr) = end_game.get_claim_tokens();

        NFToken.transferFrom(address(this), claimer, creator_token);

        for(uint i = 0; i < opponent_tokens.length; i++){
            NFToken.transferFrom(address(this), claimer, opponent_tokens[i]);
        }

        end_game.set_claim_state();
    }
}