"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type Candidate, voteForCandidate } from "@/lib/data"
import { useToast } from "@/components/ui/use-toast"
import { Check, Minus, Plus } from "lucide-react"

interface CandidateCardProps {
  candidate: Candidate
  showVotes?: boolean
  onVote?: (candidateId: string, voteCount: number) => void
  categoryName?: string
}

const VOTE_PRICE = 10 // KES per vote

import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"

export function CandidateCard({ candidate, showVotes = false, onVote, categoryName }: CandidateCardProps) {
  const [isVoting, setIsVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Get CSRF token for secure API requests
  const [csrfToken, setCsrfToken] = useState<string>('');
  
  // Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf');
        if (response.ok) {
          const token = response.headers.get('X-CSRF-Token');
          if (token) {
            setCsrfToken(token);
          }
        }
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };
    
    fetchCsrfToken();
  }, []);
  
  // Simulate successful payment for testing
  const simulateSuccessfulPayment = (method: 'mpesa' | 'card') => {
    setHasVoted(true);
    
    if (method === 'mpesa') {
      toast({
        title: 'M-Pesa Payment Initiated (Test Mode)',
        description: 'This is a test. In production, you would receive an M-Pesa prompt.'
      });
    } else {
      toast({
        title: 'Card Payment Completed (Test Mode)',
        description: 'This is a test. In production, you would be redirected to the payment gateway.'
      });
    }
    
    setShowDialog(false);
    
    // Update candidate votes (for testing only)
    candidate.votes += voteCount;
  };
  
  // Check if we're in test mode
  const isTestMode = () => {
    // Check both ways the test mode might be configured
    return process.env.NEXT_PUBLIC_TEST_MODE === 'true' || 
           window.localStorage.getItem('VOTING_TEST_MODE') === 'true';
  };
  
  // Enable test mode for development (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      window.localStorage.setItem('VOTING_TEST_MODE', 'true');
      console.log('Test mode enabled for development');
    }
  }, []);
  
  // Handle dialog vote submission
  const handleDialogVote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // For testing purposes, bypass the API call for any payment method
      if (isTestMode()) {
        console.log(`Running in test mode - simulating successful ${paymentMethod} payment`);
        simulateSuccessfulPayment(paymentMethod);
        setIsSubmitting(false);
        return;
      }
      
      // Validate phone number for M-Pesa payments before submitting
      if (paymentMethod === 'mpesa') {
        // Basic phone validation
        const phonePattern = /^(07|\+?254|0)[0-9]{8,9}$/;
        if (!phonePattern.test(phoneNumber)) {
          toast({
            title: 'Invalid Phone Number',
            description: 'Please enter a valid Kenyan phone number (e.g. 07XXXXXXXX)',
            variant: 'destructive'
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Sanitize inputs to prevent XSS attacks
      const sanitizedFirstName = firstName?.replace(/[<>]/g, '');
      const sanitizedSecondName = secondName?.replace(/[<>]/g, '');
      const sanitizedPhoneNumber = phoneNumber?.replace(/[^0-9+]/g, '');
      
      // Define the payment payload interface
      interface PaymentPayload {
        amount: number;
        kitty_id: string;
        phone_number: string;
        channel_code: string | number;
        auth_code: string;
        show_number: boolean;
        paymentMethod: 'mpesa' | 'card';
        first_name?: string;
        second_name?: string;
        show_names?: boolean;
      }
      
      // Test mode status check for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('Test mode status:', process.env.NEXT_PUBLIC_TEST_MODE);
        console.log('Available env vars:', {
          CHANNEL_CODE: process.env.NEXT_PUBLIC_ONEKITTY_CHANNEL_CODE,
          TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE
        });
      }
      
      // Prepare payment payload with proper typing
      const payload: PaymentPayload = {
        amount: voteCount * VOTE_PRICE,
        kitty_id: candidate.id,
        phone_number: sanitizedPhoneNumber,
        channel_code: process.env.NEXT_PUBLIC_ONEKITTY_CHANNEL_CODE || 63902,
        auth_code: process.env.NEXT_PUBLIC_ONEKITTY_AUTH_CODE || '',
        show_number: true,
        paymentMethod: paymentMethod as 'mpesa' | 'card'
      };
      
      // Only include name fields for card payments
      if (paymentMethod === 'card') {
        payload.first_name = sanitizedFirstName;
        payload.second_name = sanitizedSecondName;
        payload.show_names = true;
      } else {
        // For M-Pesa, we don't need names
        payload.show_names = false;
      }
      
      // Only log in development environment
      if (process.env.NODE_ENV !== 'production') {
        console.log('Sending payment request with payload:', payload);
      }
      
      try {
        // Add CSRF token to headers for security
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json' 
        };
        
        // Add CSRF token if available
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        
        // Make the payment request
        const res = await fetch('/api/contribute', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        // Check if the response is OK
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! Status: ${res.status}, Response: ${errorText || 'No response body'}`);
        }
        
        // Try to parse the response as JSON
        let data;
        try {
          data = await res.json();
          // Only log in development environment
          if (process.env.NODE_ENV !== 'production') {
            console.log('Payment API response:', data);
          }
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          throw new Error('Invalid response from payment server');
        }
        
        // Process successful response
        if (data && data.status) {
          setHasVoted(true);
          
          if (paymentMethod === 'mpesa') {
            // Special handling for M-Pesa
            toast({ 
              title: 'M-Pesa Payment Initiated', 
              description: 'Please check your phone for the M-Pesa payment prompt. If you don\'t receive it within 30 seconds, try again.'
            });
            
            // Only log in development environment
            if (process.env.NODE_ENV !== 'production') {
              console.log('M-Pesa payment initiated for phone:', phoneNumber);
            }
            
            // Update candidate votes
            candidate.votes += voteCount;
          } else {
            toast({ title: 'Payment Initiated', description: data.message || 'Payment processing started' });
          }
          
          // If card, redirect to checkout_url
          if (paymentMethod === 'card' && data.data?.checkout_url) {
            // Add detailed logging to help debug any redirect issues
            console.log('Card payment: preparing to redirect to', data.data.checkout_url);
            
            // Use secure redirect method
            if (data.data.checkout_url.startsWith('https://')) {
              // For added security, add a slight delay before redirecting
              toast({
                title: 'Card Payment Initiated',
                description: 'Redirecting you to the secure payment gateway...'
              });
              
              setTimeout(() => {
                window.location.href = data.data.checkout_url;
              }, 1500);
            } else {
              console.error('Insecure checkout URL detected:', data.data.checkout_url);
              throw new Error('Insecure payment redirect detected');
            }
          } else {
            setShowDialog(false);
          }
        } else {
          let details = (data && data.message) || 'Payment failed for unknown reason.';
          
          // Log detailed error information (only in development)
          if (process.env.NODE_ENV !== 'production') {
            console.error('Payment failed with data:', data || 'No data received');
          }
          
          if (data && data.raw) {
            const rawData = typeof data.raw === 'string' ? data.raw : JSON.stringify(data.raw);
            details += `\nDetails: ${rawData.substring(0, 100)}${rawData.length > 100 ? '...' : ''}`;
          }
          
          if (data && data.error) {
            details += `\nError: ${data.error}`;
          }
          
          // Add specific message for M-Pesa failures
          if (paymentMethod === 'mpesa') {
            details += '\n\nPlease check that your phone number is correct and in the format 07xxxxxxxx';
          }
          
          toast({ title: 'Payment Failed', description: details, variant: 'destructive' });
        }
      } catch (err) {
        // Only log the full error in development
        if (process.env.NODE_ENV !== 'production') {
          console.error('Payment processing error:', err);
        }
        
        toast({ 
          title: 'Payment Error', 
          description: err instanceof Error ? err.message : 'Payment failed. Please try again.', 
          variant: 'destructive' 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleVote = () => {
    setIsVoting(true)

    // Simulate API call
    setTimeout(() => {
      let success = true

      // Apply multiple votes
      for (let i = 0; i < voteCount; i++) {
        const voteSuccess = voteForCandidate(candidate.id)
        if (!voteSuccess) {
          success = false
          break
        }
      }

      if (success) {
        setHasVoted(true)
        toast({
          title: "Votes Recorded",
          description: `You have successfully voted for ${candidate.name} with ${voteCount} vote${voteCount > 1 ? "s" : ""}`,
        })

        if (onVote) {
          onVote(candidate.id, voteCount)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to record your votes. Please try again.",
          variant: "destructive",
        })
      }

      setIsVoting(false)
    }, 1000)
  }

  const incrementVotes = () => {
    setVoteCount((prev) => prev + 1)
  }

  const decrementVotes = () => {
    setVoteCount((prev) => (prev > 1 ? prev - 1 : 1))
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="relative w-32 h-32 mx-auto mb-2 rounded-full overflow-hidden border-4 border-primary/20">
          <Image src={candidate.imageUrl || "/placeholder.svg"} alt={candidate.name} fill className="object-cover" />
        </div>
        <h3 className="font-semibold text-lg text-center">{candidate.name}</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <Badge variant="outline">{categoryName || `Category ${candidate.category}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow text-center">
        <p className="text-sm text-muted-foreground">{candidate.description}</p>
        <p className="text-sm mt-2">
          Current votes: <span className="font-semibold text-primary">{candidate.votes}</span>
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {!showVotes && !hasVoted && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="w-full" onClick={() => setShowDialog(true)}>
                Vote
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vote for {candidate.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDialogVote} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={decrementVotes} disabled={voteCount <= 1 || isSubmitting}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-medium text-lg w-8 text-center">{voteCount}</span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={incrementVotes} disabled={isSubmitting}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="ml-4">Total: <span className="text-primary">{voteCount * VOTE_PRICE} KES</span></span>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Payment Method</label>
                  <RadioGroup value={paymentMethod} onValueChange={(val: string) => setPaymentMethod(val as 'mpesa' | 'card')} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="mpesa" id="mpesa" />
                      <label htmlFor="mpesa">MPESA</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="card" id="card" />
                      <label htmlFor="card">Card</label>
                    </div>
                  </RadioGroup>
                </div>
                {paymentMethod === 'mpesa' && (
                  <Input type="tel" placeholder="Phone Number (e.g. 2547xxxxxxx)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required />
                )}
                {paymentMethod === 'card' && (
                  <div className="flex gap-2">
                    <Input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                    <Input placeholder="Second Name" value={secondName} onChange={e => setSecondName(e.target.value)} required />
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Processing...' : `Pay ${voteCount * VOTE_PRICE} KES`}
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {!showVotes && hasVoted && (
          <div className="w-full text-center">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium">Voted Successfully</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Thank you for your {voteCount} vote{voteCount > 1 ? "s" : ""}!
            </p>
          </div>
        )}

        {showVotes && (
          <div className="w-full text-center">
            <span className="text-sm font-medium">
              Votes: <span className="text-primary font-bold">{candidate.votes}</span>
            </span>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

