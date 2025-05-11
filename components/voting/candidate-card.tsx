"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { type Candidate, voteForCandidate } from "@/lib/data"
import { useToast } from "@/components/ui/use-toast"
import { Check, Minus, Plus } from "lucide-react"
import { useSession } from "next-auth/react"
import Head from "next/head"

interface CandidateCardProps {
  candidate: Candidate
  showVotes?: boolean
  onVote?: (candidateId: string, voteCount: number) => void
  categoryName?: string
}

const VOTE_PRICE = 10 // KES per vote

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"

export function CandidateCard({ candidate, showVotes = false, onVote, categoryName }: CandidateCardProps) {
  const [isVoting, setIsVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card' | 'airtel'>('mpesa')
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
  const simulateSuccessfulPayment = (method: 'mpesa' | 'card' | 'airtel') => {
    // Set hasVoted to true temporarily
    setHasVoted(true);
    
    // Add a 5-second reset timer to allow users to vote multiple times
    setTimeout(() => {
      setHasVoted(false);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Vote button reset after test payment - user can vote again');
      }
    }, 5000);
    
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
      
      const { data: session } = useSession();
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'You must be logged in to vote.',
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }
      
      // Validate phone number for mobile money payments before submitting
      if (paymentMethod === 'mpesa' || paymentMethod === 'airtel') {
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
        paymentMethod: 'mpesa' | 'card' | 'airtel';
        first_name?: string;
        second_name?: string;
        show_names?: boolean;
      }
      
      // Test mode status check for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('Test mode status:', process.env.NEXT_PUBLIC_TEST_MODE);
        console.log('Available env vars:', {
          KITTY_ID: process.env.NEXT_PUBLIC_ONEKITTY_ID,
          TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE
        });
      }
      
      // Prepare payment payload with proper typing
      const payload: PaymentPayload = {
        amount: voteCount * VOTE_PRICE,
        kitty_id: candidate.id,
        phone_number: sanitizedPhoneNumber,
        channel_code: process.env.NEXT_PUBLIC_ONEKITTY_ID ? parseInt(process.env.NEXT_PUBLIC_ONEKITTY_ID) : 63902,
        auth_code: process.env.NEXT_PUBLIC_ONEKITTY_AUTH_CODE || '',
        show_number: true,
        paymentMethod: paymentMethod as 'mpesa' | 'card' | 'airtel'
      };
      
      // Determine channel code based on payment method
      if (paymentMethod === 'mpesa') {
        payload.channel_code = 63902;
      } else if (paymentMethod === 'airtel') {
        payload.channel_code = 63903;
      } else if (paymentMethod === 'card') {
        payload.channel_code = 55;
      }

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
        
        // Make the payment request using our direct API payment implementation
        setIsSubmitting(true);
        let res;
        try {
          // Show loading toast
          toast({
            title: 'Processing Payment',
            description: 'Please wait while we process your payment...',
            duration: 5000
          });
          
          // Use the new direct payment endpoint
          res = await fetch('/api/payments/direct', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({
              ...payload,
              idempotencyKey: `${candidate.id}-${phoneNumber}-${Date.now()}`
            })
          });
        } catch (fetchError) {
          console.error('Network error when making payment request:', fetchError);
          toast({
            variant: 'destructive',
            title: 'Connection Error',
            description: 'Network error. Please check your connection and try again.'
          });
          throw new Error('Network error. Please check your connection and try again.');
        }
        
        // Check if the response is OK
        if (!res.ok) {
          let errorData = { message: 'Unknown error' };
          try {
            errorData = await res.json();
          } catch (textError) {
            console.error('Error parsing error response:', textError);
            try {
              const errorText = await res.text();
              errorData.message = errorText || 'No response body';
            } catch (e) {
              console.error('Error reading response text:', e);
            }
          }
          
          toast({
            variant: 'destructive',
            title: 'Payment Error',
            description: errorData.message || `Error: ${res.status}`
          });
          
          throw new Error(`HTTP error! Status: ${res.status}, Message: ${errorData.message || 'Unknown error'}`);
        }
        
        // Parse the response as JSON
        let data;
        try {
          data = await res.json();
          // Only log in development environment
          if (process.env.NODE_ENV !== 'production') {
            console.log('Payment API response:', data);
          }
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          toast({
            variant: 'destructive',
            title: 'System Error',
            description: 'Invalid response from payment server'
          });
          throw new Error('Invalid response from payment server');
        }
        
        // Process successful response from our direct payment API
        if (data && data.status) {
          // Only temporarily set hasVoted to true - will be reset after 5 seconds
          setHasVoted(true);
          
          // Set a timeout to reset the hasVoted state after 5 seconds
          // This allows the user to vote again for the same candidate
          setTimeout(() => {
            setHasVoted(false);
          }, 5000);
          
          // Update candidate votes locally for immediate UI feedback
          // The actual DB update happens on the server side
          candidate.votes += voteCount;
          
          // Handle different payment methods with appropriate toast messages
          if (paymentMethod === 'mpesa') {
            toast({ 
              variant: 'default',
              title: 'M-Pesa Payment Initiated', 
              description: data.message || 'Please check your phone for the M-Pesa payment prompt. If you don\'t receive it within 30 seconds, try again.'  
            });
          } else if (paymentMethod === 'airtel') {
            toast({ 
              variant: 'default',
              title: 'Airtel Money Payment Initiated', 
              description: data.message || 'Please check your phone for the Airtel Money payment prompt. If you don\'t receive it within 30 seconds, try again.'  
            });
          } else if (paymentMethod === 'card') {
            // For card payments, we might have a checkout URL to redirect to
            if (data.data?.checkoutUrl) {
              toast({ 
                variant: 'default',
                title: 'Card Payment Ready', 
                description: 'Redirecting to secure payment page...'  
              });
              
              // Redirect to the checkout URL for card payment
              setTimeout(() => {
                window.location.href = data.data.checkoutUrl;
              }, 1500);
            } else {
              toast({ 
                variant: 'default',
                title: 'Card Payment Initiated', 
                description: data.message || 'Payment is being processed. You will receive confirmation shortly.'  
              });
            }
          } else {
            toast({ 
              variant: 'default',
              title: 'Payment Initiated', 
              description: data.message || 'Your payment is being processed. Please wait for confirmation.'  
            });
          }
          
          // Display transaction ID if available
          if (data.data?.transactionId) {
            console.log('Transaction ID:', data.data.transactionId);
          } 
          setShowDialog(false);
        } else {
          // Handle payment failure with detailed error information
          let details = (data && data.message) || 'Payment failed for unknown reason.';
          
          if (process.env.NODE_ENV !== 'production') {
            console.error('Payment failed:', data || 'No data received');
          }
          
          // Add transaction code if available
          if (data && data.code) {
            details += `\nTransaction Code: ${data.code}`;
          }
          
          // Add more error context
          if (data && data.data && data.data.error_message) {
            details += `\nDetails: ${data.data.error_message}`;
          }
          
          // Add specific message for mobile money failures
          if (paymentMethod === 'mpesa' || paymentMethod === 'airtel') {
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
        // Set hasVoted to true temporarily
        setHasVoted(true)
        
        // Add a 5-second reset timer to allow users to vote multiple times
        setTimeout(() => {
          setHasVoted(false)
          console.log('Vote button reset - user can vote again')
        }, 5000)
        
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
            <DialogContent aria-describedby="vote-dialog-desc">
              <DialogHeader>
                <DialogTitle>Vote for {candidate.name}</DialogTitle>
                <DialogDescription id="vote-dialog-desc">Select your payment details to support this candidate.</DialogDescription>
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
                  <RadioGroup value={paymentMethod} onValueChange={(val: string) => setPaymentMethod(val as 'mpesa' | 'card' | 'airtel')} className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="mpesa" id="mpesa" />
                      <label htmlFor="mpesa">MPESA</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="airtel" id="airtel" />
                      <label htmlFor="airtel">Airtel Money</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="card" id="card" />
                      <label htmlFor="card">Card</label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-1">Payments processed securely via OneKitty</p>
                </div>
                {(paymentMethod === 'mpesa' || paymentMethod === 'airtel') && (
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
