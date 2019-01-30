//== Root Query ================================================================

//-- Construct Query -----------------------------
const Query = {
  //-- Sanity Check Query returns 'Hello'
  hello: () => 'Hello',
  //-- Begin Project Queries
  user: (parent, args, context) => {

    if (context.request.session.passport){
      console.log('i used context to resolve', context.request.session.passport.user);
      return context.prisma.user({ id: context.request.session.passport.user});
    };
    if (!context.request.session.passport){
      console.log('i used the passed in id', args.id)
      return context.prisma.user({ id: args.id });
    }
  },
  users: (parent, args, context) => {
    return context.prisma.users();
  },
  countries: (parent, args, context) => {
    return context.prisma.countries();
  },
  countryById: (parent, args, context) => {
    return context.prisma.country({ id: args.id });
  },
  countryByName: (parent, args, context) => {
    return context.prisma.country({ name: args.name });
  },
  visits: (parent, args, context) => {
    return context.prisma.visits();
  },
  visit: (parent, args, context) => {
    return context.prisma.visit({ id: args.id });
  },
  friends: (parent, args, context) => {
    return context.prisma.user({ id: args.id }).friends()
  }
};

//-- Export --------------------------------------
module.exports = {
  Query
}
