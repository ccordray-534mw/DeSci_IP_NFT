# DeSci IP NFT: A Revolutionary NFT for Scientific Research

DeSci IP NFT leverages **Zama's Fully Homomorphic Encryption technology** to create NFTs that symbolize ownership stakes in the future intellectual property (IP) earnings of groundbreaking scientific research projects. This innovative approach enables early supporters to securely invest in the future of science while maintaining their anonymity and privacy.

## The Challenge in Scientific Research Funding

In the realm of scientific research, funding is often a significant hurdle, particularly for early-stage projects with high risks and uncertain outcomes. Traditional financing mechanisms may not be suited for innovative yet unproven ideas, leaving many groundbreaking projects underfunded or struggling to reach their potential. Furthermore, there is an increasing need for transparency and privacy in transactions, especially when dealing with intellectual property rights. 

## The FHE Solution

Using **Zama's open-source libraries**, such as **Concrete** and **TFHE-rs**, our project introduces a novel method of crowdfunding scientific endeavors by converting future IP earnings into NFTs. By employing Fully Homomorphic Encryption (FHE), we ensure that the identities and stakes of early supporters are securely protected. This allows for a new financing channel that not only empowers public engagement in scientific advancements but also shields investor privacy.

With FHE, the NFT’s ownership can be verified without revealing sensitive information, thus enabling a trustless and secure environment for both researchers and investors. This blend of transparency and confidentiality is essential for fostering a vibrant ecosystem of scientific research funding.

## Key Features

- **NFT Representation**: Represents a stake in the future earnings of a research project's IP.
- **Privacy Protection**: Utilizing FHE to encrypt the identities and stakes of NFT holders, ensuring complete confidentiality.
- **Innovative Financing Solutions**: Provides a new method of funding high-risk foundational research.
- **Public Participation**: Enables the public to invest in the scientific research landscape, democratizing funding opportunities.
- **Market Integration**: Seamlessly integrates with existing NFT marketplaces to facilitate trading and valuation.

## Technology Stack

- **Solidity**: Smart contract development for Ethereum-based NFTs
- **Zama FHE SDK**: The foundational library for implementing Fully Homomorphic Encryption
- **Node.js**: JavaScript runtime for backend services
- **Hardhat**: For smart contract development and testing
- **React**: Frontend framework for building user interfaces

## Directory Structure

```
DeSci_IP_NFT/
│
├── contracts/
│   └── DeSci_IP_NFT.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── test_DeSci_IP_NFT.js
├── package.json
└── README.md
```

## Installation Guide

To set up the DeSci IP NFT project, ensure you have the following dependencies installed:

1. **Node.js**: Ensure that Node.js is installed on your machine.
2. **Hardhat**: This project uses Hardhat for compiling and testing smart contracts. You can install Hardhat by following its official documentation.

After confirming the dependencies, follow these steps to set up the project:

1. Download the project files.
2. Navigate to the project directory using your command line interface (CLI).
3. Run the following command to install the necessary libraries:

   ```bash
   npm install
   ```

   This command will also fetch the required Zama FHE libraries.

## Build & Run Guide

Once the installation is complete, you're ready to build and test your NFT project. Here are the commands you need:

### Compile the Smart Contracts

To compile the smart contracts, run:

```bash
npx hardhat compile
```

### Run Tests

To execute the test suite and ensure everything is functioning correctly, use:

```bash
npx hardhat test
```

### Deploy the Smart Contract

To deploy your NFT smart contract to a local network, use:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Interaction Example

Here’s a snippet demonstrating how to mint a new DeSci IP NFT:

```javascript
const DeSciIPNFT = await ethers.getContractFactory("DeSci_IP_NFT");
const deSciIPNFT = await DeSciIPNFT.deploy();
await deSciIPNFT.deployed();

const tx = await deSciIPNFT.mintNFT("0xYourAddressHere", "UniqueTokenId123");
await tx.wait();

console.log("NFT Minted: ", tx.hash);
```

## Acknowledgements

### Powered by Zama

We would like to extend our heartfelt gratitude to the Zama team for their pioneering work in Fully Homomorphic Encryption and their open-source tools that empower us to develop secure and confidential blockchain applications. Through their innovative technology, we can redefine the intersection of science and investment.

---

By utilizing DeSci IP NFT, you are not just investing in a token; you are actively participating in the future of scientific research while ensuring that your engagement remains private and secure.
