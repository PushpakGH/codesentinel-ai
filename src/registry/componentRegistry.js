/**
 * Embedded Component Registry
 * No database needed - everything in JSON files
 */

const COMPONENT_LIBRARY = {
  tailwind: {
    Button: {
      usage: "Use className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'",
      example: "<button className='bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded'>Click</button>"
    },
    Card: {
      usage: "Use className='bg-white shadow-md rounded px-8 py-6'",
      example: "<div className='bg-white shadow-md rounded px-8 py-6'><h2>Title</h2></div>"
    }
  },
  
  daisyui: {
    Button: {
      usage: "Use className='btn btn-primary'",
      example: "<button className='btn btn-primary'>Click</button>",
      requires: ["daisyui"]
    },
    Card: {
      usage: "Use className='card bg-base-100 shadow-xl'",
      example: "<div className='card bg-base-100 shadow-xl'><div className='card-body'><h2 className='card-title'>Title</h2></div></div>",
      requires: ["daisyui"]
    }
  }
};

function getDocs(library, componentNames) {
  const lib = COMPONENT_LIBRARY[library];
  if (!lib) return {};

  const docs = {};
  for (const name of componentNames) {
    if (lib[name]) {
      docs[name] = lib[name];
    }
  }
  return docs;
}

module.exports = { getDocs, COMPONENT_LIBRARY };
