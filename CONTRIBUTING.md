# Contributing to Dropdesk

First off, thank you for considering contributing to Dropdesk! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## Getting Started

1. **Fork the Repository**
   Click the "Fork" button at the top right of the repository page to create a copy in your own GitHub account.

2. **Clone your Fork**
   Clone your forked repository to your local machine:
   ```bash
   git clone https://github.com/<your-username>/Dropdesk.git
   cd Dropdesk
   ```

3. **Set Up the Upstream Remote**
   Keep your fork in sync with the original repository by adding it as an upstream remote:
   ```bash
   git remote add upstream https://github.com/iCoderabhishek/Dropdesk.git
   ```

4. **Install Dependencies**
   Make sure you have [Bun](https://bun.sh/) installed, then run:
   ```bash
   bun install
   ```

### Alternative: Running entirely with Docker

If you prefer to run the entire stack (Database, Redis, and the API) in Docker without installing Bun locally:

1. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
2. **Start the Stack**
   ```bash
   docker-compose up --build -d
   ```
3. **Run Migrations**
   Once the containers are running, execute the database migrations inside the backend container:
   ```bash
   docker-compose exec backend bun run migrate
   ```
   
The API will now be accessible at `http://localhost:8080` (or your configured `API_PORT`).

## Making Changes

1. **Create a Branch**
   Always create a new branch for your feature, bug fix, or documentation update. Avoid making changes directly on the `main` branch.
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Write your Code**
   Make your changes in your code. Ensure your code follows the existing style and format.
   - Run `bun run lint` to check for linting errors.
   - Run `bun run format` to automatically format your code with Prettier.

3. **Test Your Changes**
   Make sure your changes do not break existing functionality. Start the development server (`bun run dev`) and test your changes locally. If you add new API endpoints, make sure to add Swagger annotations for them!

## Submitting a Pull Request

1. **Sync with Upstream**
   Before submitting your PR, fetch the latest changes from the upstream `main` branch and merge them into your branch to avoid merge conflicts:
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

2. **Push to Your Fork**
   Push your branch to your forked repository:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request**
   Navigate to the original Dropdesk repository on GitHub. You should see a prompt to create a pull request from your recently pushed branch. Click **"Compare & pull request"**.
   - Provide a clear and descriptive title.
   - Explain the problem you've solved or the feature you've added in the description.

## Code of Conduct
Please ensure that your interactions in issues and pull requests are respectful, constructive, and welcoming to all developers.

Cheers 🍻
