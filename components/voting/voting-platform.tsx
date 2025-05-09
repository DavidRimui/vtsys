"use client"

import { useState, useEffect } from "react"
import { type Candidate, categories } from "@/lib/data"
import { CandidateCard } from "@/components/voting/candidate-card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { useRealTimeVotes } from "@/lib/vote-service"

export function VotingPlatform() {
  const { candidates, isLoading } = useRealTimeVotes()
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    // Apply filters
    let filtered = candidates

    if (searchTerm) {
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((c) => c.category === categoryFilter)
    }

    setFilteredCandidates(filtered)
  }, [searchTerm, categoryFilter, candidates])

  const handleVote = (candidateId: string, voteCount: number) => {
    // The vote is already handled in the CandidateCard component
    // and the real-time updates will pick up the change
    console.log(`Voted for candidate ${candidateId} with ${voteCount} votes`)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : `Category ${categoryId}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Vote for Your Candidate</h1>

      <div className="bg-muted/50 p-4 rounded-lg mb-8">
        <h2 className="text-lg font-semibold mb-2">How Voting Works</h2>
        <p className="text-sm text-muted-foreground">
          Each vote costs <span className="font-medium text-primary">10 KES</span>. You can purchase multiple votes for
          your favorite candidate. Use the + and - buttons to adjust the number of votes, and the total cost will be
          calculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="relative">
          <Label htmlFor="search" className="mb-2 block">
            Search Candidates
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="category" className="mb-2 block">
            Filter by Category
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No candidates found</h2>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onVote={handleVote}
              categoryName={getCategoryName(candidate.category)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
