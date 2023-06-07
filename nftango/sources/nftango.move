module overmind::nftango {
    use std::option::Option;
    use std::option;
    use std::string::String;
    use std::error;
    use aptos_framework::account;
    use std::vector;
    use std::signer;
    use aptos_token::token::TokenId;
    use aptos_token::token;

    //
    // Errors
    //
    const ERROR_NFTANGO_STORE_EXISTS: u64 = 0;
    const ERROR_NFTANGO_STORE_DOES_NOT_EXIST: u64 = 1;
    const ERROR_NFTANGO_STORE_IS_ACTIVE: u64 = 2;
    const ERROR_NFTANGO_STORE_IS_NOT_ACTIVE: u64 = 3;
    const ERROR_NFTANGO_STORE_HAS_AN_OPPONENT: u64 = 4;
    const ERROR_NFTANGO_STORE_DOES_NOT_HAVE_AN_OPPONENT: u64 = 5;
    const ERROR_NFTANGO_STORE_JOIN_AMOUNT_REQUIREMENT_NOT_MET: u64 = 6;
    const ERROR_NFTS_ARE_NOT_IN_THE_SAME_COLLECTION: u64 = 7;
    const ERROR_NFTANGO_STORE_DOES_NOT_HAVE_DID_CREATOR_WIN: u64 = 8;
    const ERROR_NFTANGO_STORE_HAS_CLAIMED: u64 = 9;
    const ERROR_NFTANGO_STORE_IS_NOT_PLAYER: u64 = 10;
    const ERROR_VECTOR_LENGTHS_NOT_EQUAL: u64 = 11;

    //
    // Data structures
    //
    struct NFTangoStore has key {
        creator_token_id: TokenId,
        // The number of NFTs (one more more) from the same collection that the opponent needs to bet to enter the game
        join_amount_requirement: u64,
        opponent_address: Option<address>,
        opponent_token_ids: vector<TokenId>,
        active: bool,
        has_claimed: bool,
        did_creator_win: Option<bool>,
        signer_capability: account::SignerCapability
    }

    //
    // Assert functions
    //
    public fun assert_nftango_store_exists(
        account_address: address,
    ) {
        assert!(exists<NFTangoStore>(account_address), error::invalid_state(ERROR_NFTANGO_STORE_DOES_NOT_EXIST));
    }

    public fun assert_nftango_store_does_not_exist(
        account_address: address,
    ) {
        assert!(!exists<NFTangoStore>(account_address), error::invalid_state(ERROR_NFTANGO_STORE_EXISTS));
    }

    public fun assert_nftango_store_is_active(
        account_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(account_address); 
        assert!(store.active, error::invalid_argument(ERROR_NFTANGO_STORE_IS_NOT_ACTIVE));
    }

    public fun assert_nftango_store_is_not_active(
        account_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(account_address); 
        assert!(!store.active, error::invalid_argument(ERROR_NFTANGO_STORE_IS_ACTIVE));
    }

    public fun assert_nftango_store_has_an_opponent(
        account_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(account_address);
        assert!(option::is_some<address>(&store.opponent_address), error::invalid_argument(ERROR_NFTANGO_STORE_DOES_NOT_HAVE_AN_OPPONENT));
    }

    public fun assert_nftango_store_does_not_have_an_opponent(
        account_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(account_address);
        assert!(option::is_none<address>(&store.opponent_address), error::invalid_argument(ERROR_NFTANGO_STORE_HAS_AN_OPPONENT));
    }

    public fun assert_nftango_store_join_amount_requirement_is_met(
        game_address: address,
        token_ids: vector<TokenId>,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(game_address);
        let total_nft = vector::length(&token_ids);
        assert!(store.join_amount_requirement == total_nft, error::invalid_argument(ERROR_NFTANGO_STORE_JOIN_AMOUNT_REQUIREMENT_NOT_MET));
    }

    public fun assert_nftango_store_has_did_creator_win(
        game_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(game_address);
        assert!(option::is_some<bool>(&store.did_creator_win), error::invalid_argument(ERROR_NFTANGO_STORE_DOES_NOT_HAVE_DID_CREATOR_WIN));
    }

    public fun assert_nftango_store_has_not_claimed(
        game_address: address,
    ) acquires NFTangoStore {
        let store = borrow_global<NFTangoStore>(game_address);
        assert!(!store.has_claimed, error::invalid_argument(ERROR_NFTANGO_STORE_HAS_CLAIMED));
    }

    public fun assert_nftango_store_is_player(account_address: address, game_address: address) acquires NFTangoStore {
        // TODO: assert that `account_address` is either the equal to `game_address` or `NFTangoStore.opponent_address`
        assert_nftango_store_has_an_opponent(game_address);
        let store = borrow_global<NFTangoStore>(game_address);
        let opponent = option::borrow<address>(&store.opponent_address);
        assert!((account_address == game_address) || (account_address == *opponent), error::invalid_argument(ERROR_NFTANGO_STORE_IS_NOT_PLAYER));

    }

    public fun assert_vector_lengths_are_equal(creator: vector<address>,
                                               collection_name: vector<String>,
                                               token_name: vector<String>,
                                               property_version: vector<u64>) {
        let creator_len = vector::length(&creator);
        let collection_len = vector::length(&collection_name);
        let token_len = vector::length(&token_name);
        let property_len = vector::length(&property_version);

        assert!((creator_len == collection_len)&&(token_len==property_len)&&(collection_len==token_len), error::invalid_state(ERROR_VECTOR_LENGTHS_NOT_EQUAL));
    }

    //
    // Entry functions
    //
    
    public entry fun initialize_game(
        account: &signer,
        creator: address,
        collection_name: String,
        token_name: String,
        property_version: u64,
        join_amount_requirement: u64
    ) {
        // Check if the creator of the game already have a active game resource
        assert_nftango_store_does_not_exist(signer::address_of(account));

        // Create a resource account under the creator's address to manage the game
        let (resource_signer, resource_cap) = account::create_resource_account(account, b"This is Random");

        let tokenId = token::create_token_id_raw(creator, collection_name, token_name, property_version);
        token::opt_in_direct_transfer(&resource_signer, true);

        // Transfer NFT to resource account
        token::transfer(account, tokenId, signer::address_of(&resource_signer), 1); 

        let game_store = NFTangoStore {
            creator_token_id: tokenId,
            join_amount_requirement: join_amount_requirement,
            opponent_address: option::none<address>(),
            opponent_token_ids: vector::empty<TokenId>(),
            active: true,
            has_claimed: false,
            did_creator_win: option::none<bool>(),
            signer_capability: resource_cap
            };
            move_to<NFTangoStore>(account, game_store);
        }

    public entry fun cancel_game(
        account: &signer,
    ) acquires NFTangoStore {
        // Game can only be cancelled if it has been initiated and an opponent has not joined
        let address = signer::address_of(account);
        assert_nftango_store_exists(address);
        assert_nftango_store_is_active(address);
        assert_nftango_store_does_not_have_an_opponent(address);

        token::opt_in_direct_transfer(account, true);

        let store = borrow_global_mut<NFTangoStore>(address);
        let resource_signer = account::create_signer_with_capability(&store.signer_capability);
        
        // Transfer NFT back to account address
        token::transfer(&resource_signer, store.creator_token_id, address, 1); 

        store.active = false;
    }

    public fun join_game(
        account: &signer,
        game_address: address,
        creators: vector<address>,
        collection_names: vector<String>,
        token_names: vector<String>,
        property_versions: vector<u64>,
    ) acquires NFTangoStore {
        // Check information present for all NFTs
        assert_vector_lengths_are_equal(creators, collection_names, token_names, property_versions);

        // Create opponent NFTs from data
        let token_ids = vector::empty<TokenId>();
        let vec_len = vector::length(&creators);
        let i = 0;
        while (i < vec_len){
            let creator = vector::borrow<address>(&creators, i);
            let collection = vector::borrow<String>(&collection_names, i);
            let token = vector::borrow<String>(&token_names, i);
            let property_v = vector::borrow<u64>(&property_versions, i);

            let current_token_id_data = token::create_token_data_id(*creator, *collection, *token);
            let current_token = token::create_token_id(current_token_id_data, *property_v);

            vector::push_back<TokenId>(&mut token_ids, current_token);
            i = i+1;
        };

        // Check that there isn't existing opponent and the NFTs provided meets the joining requirement
        let address = signer::address_of(account);
        assert_nftango_store_exists(game_address);
        assert_nftango_store_is_active(game_address);
        assert_nftango_store_does_not_have_an_opponent(game_address);
        assert_nftango_store_join_amount_requirement_is_met(game_address, token_ids);

        let store = borrow_global_mut<NFTangoStore>(game_address);
        let resource_signer = account::create_signer_with_capability(&store.signer_capability);

        //Transfer oppoenent NFTs to resource account
        i = 0;
        while (i < vec_len){
            let current_token = vector::borrow<TokenId>(&token_ids, i);
            token::transfer(account, *current_token, signer::address_of(&resource_signer), 1); 

            i = i+1;
        };

        option::fill(&mut store.opponent_address, address);
        store.opponent_token_ids = token_ids;
    }

    public entry fun play_game(account: &signer, did_creator_win: bool) acquires NFTangoStore {
        let address = signer::address_of(account);
        assert_nftango_store_exists(address);
        assert_nftango_store_is_active(address);
        assert_nftango_store_has_an_opponent(address);

        let store = borrow_global_mut<NFTangoStore>(address);
        option::fill(&mut store.did_creator_win, did_creator_win);
        store.active = false;
    }

    public entry fun claim(account: &signer, game_address: address) acquires NFTangoStore {
        // Check a claim has not occurred and the claimer is creator or opponent
        assert_nftango_store_exists(game_address);
        assert_nftango_store_is_not_active(game_address);
        assert_nftango_store_has_not_claimed(game_address);
        assert_nftango_store_is_player(signer::address_of(account), game_address);

        let store = borrow_global_mut<NFTangoStore>(game_address);
        let resource_signer = account::create_signer_with_capability(&store.signer_capability);
        let tokens = store.opponent_token_ids;
        let token_len = vector::length<TokenId>(&tokens);
        let i = 0;
        let game_state = option::borrow<bool>(&store.did_creator_win);
        let creator_token = store.creator_token_id;
        
        // If the creator won or opponent won
        if((*game_state && signer::address_of(account) == game_address) 
        || (!(*game_state) && signer::address_of(account) == *option::borrow<address>(&store.opponent_address))){
            // Transfer the opponent token
            while(i < token_len){
                let current_token = vector::borrow<TokenId>(&tokens, i);

                token::transfer(&resource_signer, *current_token, signer::address_of(account), 1); 
                i=i+1;
            };
            // Transfer the creator token
            token::transfer(&resource_signer, creator_token, signer::address_of(account), 1); 
        };
        store.has_claimed = true;
    }
}