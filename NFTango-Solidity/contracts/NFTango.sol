//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTango is Ownable{

    // Error Codes
    string private constant CODE_2 = "ERROR_NFTANGO_STORE_IS_ACTIVE";
    string private constant CODE_3 = "ERROR_NFTANGO_STORE_IS_NOT_ACTIVE";
    string private constant CODE_4 = "ERROR_NFTANGO_STORE_HAS_AN_OPPONENT";
    string private constant CODE_5 = "ERROR_NFTANGO_STORE_DOES_NOT_HAVE_AN_OPPONENT";
    string private constant CODE_6 = "ERROR_NFTANGO_STORE_JOIN_AMOUNT_REQUIREMENT_NOT_MET";
    string private constant CODE_7 = "ERROR_NFTANGO_STORE_DOES_NOT_HAVE_DID_CREATOR_WIN";
    string private constant CODE_8 = "ERROR_NFTANGO_STORE_HAS_CLAIMED";
    string private constant CODE_9 = "ERROR_NFTANGO_STORE_IS_NOT_PLAYER";


    // Data structures
    struct NFTangoStore{
        uint creator_token_id;
        uint join_amount_requirement;
        address opponent_address;
        uint[] opponent_token_ids;
        bool active;
        bool has_claimed;
        bool did_creator_win;
    }

    NFTangoStore store;

    // Assert functions
    function assert_nftango_store_is_active() public view{
        require(store.active, CODE_3);
    }

    function assert_nftango_store_is_not_active() public view{
        require(!store.active, CODE_2);
    }

    function assert_nftango_store_has_an_opponent() public view{
        require(store.opponent_address != address(0), CODE_5);
    }

    function assert_nftango_store_does_not_have_an_opponent() public view{
        require(store.opponent_address == address(0), CODE_4);
    }

    function assert_nftango_store_join_amount_requirement_is_met(uint[] calldata token_ids, address[] calldata collection_address) public view{
        // Require exact amount specified
        require(store.join_amount_requirement == token_ids.length, CODE_6);
        
        //Require they come form the same collection
        address first = collection_address[0];
        uint len = collection_address.length;
        if (len > 1){
            for (uint i = 1; i < len; i++){
                require(collection_address[i]==first, CODE_6);
            }
        }
    }

/*     public fun assert_nftango_store_has_did_creator_win() private {
        
    } */

    function assert_nftango_store_has_not_claimed() public view{
        require(!store.has_claimed, CODE_8);
    }

    function assert_claimer_is_player(address account_address, address creator_address) public view{
        require(account_address == creator_address || account_address == store.opponent_address, CODE_9);
    }

    function set_initialized_state(uint creator_NFT, uint join_req) public onlyOwner{
        store.creator_token_id = creator_NFT;
        store.join_amount_requirement = join_req;
        store.active = true;
        store.has_claimed = false;
        store.did_creator_win = false;
    }
    function get_creator_token() public view onlyOwner returns(uint){
        return store.creator_token_id;
    } 

    function set_cancel_state() public onlyOwner{
        store.active = false;
    }

    function set_join_state(address opponent, uint[] calldata tokens) public onlyOwner {
        store.opponent_address = opponent;
        store.opponent_token_ids = tokens;
    }

    function get_result() public view returns(bool){
        return store.did_creator_win;
    }

    function set_game_state(bool result) public onlyOwner {
        store.did_creator_win = result;
        store.active = false;
    }

    function get_claim_tokens() public view onlyOwner returns(uint, uint[] memory, address) {
        return (store.creator_token_id, store.opponent_token_ids, store.opponent_address);

    }
    function set_claim_state() public onlyOwner {
        store.has_claimed = true;
    }
}