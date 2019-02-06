import React from 'react'
import { Button } from 'semantic-ui-react'
import { Mutation } from 'react-apollo';
import {
  QUERY_ME_PROFILE,
  MUTATION_DELETEFRIEND_PROFILE } from '../../services/requests/profile';

const DeleteFriendButton = ({ userId, friendId }) => {
  return (
    <Mutation
      mutation={MUTATION_DELETEFRIEND_PROFILE}
      variables={{ userId: userId, friendId: friendId }}
      update={(cache, {data}) => {
        const result = cache.readQuery({ query: QUERY_ME_PROFILE });
        console.log(result);
        const friends = result.me.friends.filter(friend => friend.id !== friendId);
        result.me.friends = friends; 
        console.log('after', result);
        cache.writeQuery({
          query: QUERY_ME_PROFILE,
          data: { result },
        });
      }}
    >
    {deleteFriend => (
      <Button
        className='delete'
        fluid
        onClick={deleteFriend}
      >Delete friend</Button>
    )}
    </Mutation>
  )
}

export default DeleteFriendButton;
